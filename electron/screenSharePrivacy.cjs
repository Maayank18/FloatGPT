/**
 * Screen Share Privacy for FloatGPT windows.
 *
 * Capture exclusion uses BrowserWindow.setContentProtection, which on Windows
 * maps to WDA_EXCLUDEFROMCAPTURE. That removes the window from capture on
 * Windows 10 version 2004 (build 19041) and later. Older builds can turn the
 * window into a black rectangle instead, so this module refuses to enable
 * exclusion there. Electron 33.4.11 does not implement isContentProtected().
 * Where a later Electron build does, that flag only echoes the last request.
 * It is not proof that Meet, OBS, Teams, or Zoom actually omitted the window.
 *
 * Manual hide is a separate state and does not change the saved preference.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const RESTORE_HOTKEY = 'CommandOrControl+Shift+H';
const SUMMON_HOTKEY = 'CommandOrControl+Shift+Space';
const MIN_WINDOWS_BUILD = 19041;
const COMPOSITION_SETTLE_MS = 250;

function windowsBuildNumber(release) {
  const parts = String(release || '').split('.');
  const build = Number(parts[2]);
  return Number.isFinite(build) ? build : 0;
}

function captureExclusionSupported(platform, release) {
  if (platform !== 'win32') return false;
  return windowsBuildNumber(release) >= MIN_WINDOWS_BUILD;
}

function shortcutsConflict(summonHotkey) {
  return String(summonHotkey || '').toLowerCase() === RESTORE_HOTKEY.toLowerCase();
}

function createScreenSharePrivacy(deps) {
  const getWindows = deps.getWindows || (() => []);
  const userDataDir = deps.userDataDir || (() => os.tmpdir());
  const platform = deps.platform || process.platform;
  const release = deps.release || os.release();
  const readFile = deps.readFile || fs.readFileSync;
  const writeFile = deps.writeFile || fs.writeFileSync;
  const mkdir = deps.mkdir || fs.mkdirSync;
  const now = deps.now || Date.now;
  const schedule = deps.schedule || ((fn, ms) => setTimeout(fn, ms));
  const cancel = deps.cancel || ((id) => clearTimeout(id));

  let excludeFromCapture = false;
  let manuallyHidden = false;
  let applyFailed = false;
  let settled = true;
  let settleTimer = null;
  let captureDepth = 0;
  let captureSnapshot = null;
  let hiddenByUser = [];
  let publisher = null;
  const supported = captureExclusionSupported(platform, release);

  function filePath() {
    return path.join(userDataDir(), 'screen-share-privacy.json');
  }

  function liveWindows() {
    return getWindows().filter((win) => win && !win.isDestroyed());
  }

  function publish() {
    if (typeof publisher === 'function') publisher(getState());
  }

  function save() {
    try {
      mkdir(userDataDir(), { recursive: true });
      writeFile(filePath(), JSON.stringify({ excludeFromCapture: excludeFromCapture === true }));
    } catch (err) {
      applyFailed = true;
      console.warn('[FloatGPT] Could not save screen-share privacy preference:', err.message);
    }
  }

  function load() {
    try {
      const parsed = JSON.parse(readFile(filePath(), 'utf8'));
      excludeFromCapture = parsed.excludeFromCapture === true;
    } catch {
      excludeFromCapture = false;
    }
    applyFailed = false;
    settled = true;
    applyProtection();
    publish();
    return getState();
  }

  function applyToWindow(win) {
    if (!win || win.isDestroyed() || typeof win.setContentProtection !== 'function') {
      applyFailed = true;
      return false;
    }
    const enable = excludeFromCapture === true && supported;
    try {
      win.setContentProtection(enable);
    } catch {
      applyFailed = true;
      return false;
    }
    if (typeof win.isContentProtected === 'function' && win.isContentProtected() !== enable) {
      applyFailed = true;
      return false;
    }
    return true;
  }

  function applyProtection() {
    applyFailed = false;
    if (excludeFromCapture && !supported) {
      applyFailed = true;
      return false;
    }
    let ok = true;
    for (const win of liveWindows()) {
      if (!applyToWindow(win)) ok = false;
    }
    return ok;
  }

  function status() {
    if (manuallyHidden) return 'hidden';
    if (!excludeFromCapture) return 'off';
    if (!supported || applyFailed) return 'unsupported';
    if (!settled) return 'enabling';
    return 'enabled-unverified';
  }

  function getState() {
    return {
      excludeFromCapture,
      manuallyHidden,
      supported,
      windowsBuild: platform === 'win32' ? windowsBuildNumber(release) : null,
      status: status(),
      externalCaptureVerified: false,
      restoreShortcut: 'Ctrl+Shift+H',
      summonShortcut: 'Ctrl+Shift+Space',
      detail: statusDetail(status(), supported),
    };
  }

  function setExcludeFromCapture(enabled) {
    excludeFromCapture = enabled === true;
    applyFailed = false;
    save();
    if (settleTimer) {
      cancel(settleTimer);
      settleTimer = null;
    }
    const ok = applyProtection();
    if (!excludeFromCapture || !ok) {
      settled = true;
      publish();
      return getState();
    }
    settled = false;
    publish();
    settleTimer = schedule(() => {
      settleTimer = null;
      settled = true;
      publish();
    }, COMPOSITION_SETTLE_MS);
    return getState();
  }

  function hideNow() {
    const kept = manuallyHidden ? hiddenByUser.filter((win) => win && !win.isDestroyed()) : [];
    manuallyHidden = true;
    const fromCapture = (captureSnapshot || []).filter((entry) => entry && entry.visible).map((entry) => entry.win);
    const seen = new Set(kept);
    hiddenByUser = kept;
    for (const win of [...liveWindows(), ...fromCapture]) {
      if (!win || win.isDestroyed()) continue;
      let visible = false;
      try { visible = !!win.isVisible(); } catch {}
      const wasShownForCapture = fromCapture.includes(win);
      if (!visible && !wasShownForCapture && !seen.has(win)) continue;
      if (!seen.has(win)) {
        seen.add(win);
        hiddenByUser.push(win);
      }
      try { if (visible) win.hide(); } catch {}
    }
    publish();
    return getState();
  }

  function restore() {
    manuallyHidden = false;
    applyProtection();
    const targets = hiddenByUser;
    hiddenByUser = [];
    for (const win of targets) {
      if (!win || win.isDestroyed()) continue;
      try {
        if (typeof win.getOpacity === 'function' && win.getOpacity() === 0 && typeof win.setOpacity === 'function') {
          win.setOpacity(1);
        }
        if (typeof win.isMinimized === 'function' && win.isMinimized()) win.restore();
        if (typeof win.show === 'function') win.show();
      } catch {}
    }
    publish();
    return getState();
  }

  function isManuallyHidden() {
    return manuallyHidden;
  }

  function protectWindow(win) {
    applyToWindow(win);
    publish();
  }

  function reapply() {
    applyProtection();
    publish();
    return getState();
  }

  function beginCaptureHide() {
    captureDepth += 1;
    if (captureDepth > 1 && captureSnapshot) return captureSnapshot;
    const hidden = [];
    for (const win of liveWindows()) {
      let visible = false;
      let opacity = 1;
      let alwaysOnTop = false;
      let focused = false;
      try { visible = !!win.isVisible(); } catch {}
      try { opacity = typeof win.getOpacity === 'function' ? win.getOpacity() : 1; } catch {}
      try { alwaysOnTop = !!win.isAlwaysOnTop(); } catch {}
      try { focused = !!win.isFocused(); } catch {}
      hidden.push({ win, visible, opacity, alwaysOnTop, focused });
      if (!visible) continue;
      try { if (typeof win.setOpacity === 'function') win.setOpacity(0); } catch {}
      try { win.hide(); } catch {}
    }
    captureSnapshot = hidden;
    return hidden;
  }

  function endCaptureHide(hidden) {
    captureDepth = Math.max(0, captureDepth - 1);
    if (captureDepth > 0) return;
    const rows = Array.isArray(hidden) ? hidden : [];
    try {
      applyProtection();
      for (const entry of rows) {
        const win = entry && entry.win;
        if (!win || win.isDestroyed() || !entry.visible) continue;
        try { if (typeof win.setOpacity === 'function') win.setOpacity(entry.opacity); } catch {}
        if (manuallyHidden) continue;
        try {
          if (entry.alwaysOnTop) win.setAlwaysOnTop(true, 'screen-saver', 1);
          else win.setAlwaysOnTop(false);
        } catch {}
        try {
          if (entry.focused && typeof win.show === 'function') win.show();
          else if (typeof win.showInactive === 'function') win.showInactive();
          else if (typeof win.show === 'function') win.show();
        } catch {}
      }
    } finally {
      captureSnapshot = null;
    }
  }

  function setPublisher(fn) {
    publisher = fn;
  }

  return {
    load,
    save,
    getState,
    setExcludeFromCapture,
    hideNow,
    restore,
    isManuallyHidden,
    protectWindow,
    reapply,
    beginCaptureHide,
    endCaptureHide,
    setPublisher,
    now,
  };
}

function statusDetail(status, supported) {
  if (status === 'hidden') return 'Temporarily hidden. Press Ctrl+Shift+H to restore. Screen-share protection was not changed.';
  if (status === 'off') return 'Off. Screen shares can show FloatGPT.';
  if (status === 'enabling') return 'Turning on. FloatGPT stays on your screen.';
  if (status === 'enabled-unverified') {
    return 'On. FloatGPT stays on your screen. Windows screen shares and recordings should leave it out.';
  }
  if (!supported) {
    return 'This PC cannot hide FloatGPT from screen share. It needs Windows 10 version 2004 or later.';
  }
  return 'Screen-share protection could not be applied. FloatGPT is still on your screen and still usable.';
}

let shared = null;

function getSharedPrivacy() {
  if (!shared) {
    const { BrowserWindow, app } = require('electron');
    shared = createScreenSharePrivacy({
      getWindows: () => BrowserWindow.getAllWindows(),
      userDataDir: () => app.getPath('userData'),
    });
    shared.setPublisher((state) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (win.isDestroyed()) continue;
        try { win.webContents.send('privacy:state', state); } catch {}
      }
    });
    shared.load();
  }
  return shared;
}

module.exports = {
  RESTORE_HOTKEY,
  SUMMON_HOTKEY,
  MIN_WINDOWS_BUILD,
  COMPOSITION_SETTLE_MS,
  windowsBuildNumber,
  captureExclusionSupported,
  shortcutsConflict,
  createScreenSharePrivacy,
  getSharedPrivacy,
};
