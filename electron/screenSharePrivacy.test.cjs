const assert = require('node:assert/strict');
const {
  RESTORE_HOTKEY,
  SUMMON_HOTKEY,
  captureExclusionSupported,
  shortcutsConflict,
  createScreenSharePrivacy,
} = require('./screenSharePrivacy.cjs');

assert.equal(captureExclusionSupported('win32', '10.0.19041'), true);
assert.equal(captureExclusionSupported('win32', '10.0.22631'), true);
assert.equal(captureExclusionSupported('win32', '10.0.18363'), false);
assert.equal(captureExclusionSupported('darwin', '24.0.0'), false);
assert.equal(shortcutsConflict(SUMMON_HOTKEY), false);
assert.equal(shortcutsConflict(RESTORE_HOTKEY), true);
assert.notEqual(RESTORE_HOTKEY, SUMMON_HOTKEY);

function fakeWindow(extra = {}) {
  const win = {
    destroyed: false,
    visible: extra.visible !== false,
    opacity: 1,
    alwaysOnTop: !!extra.alwaysOnTop,
    focused: !!extra.focused,
    minimized: false,
    protected: false,
    fail: !!extra.fail,
    isDestroyed() { return this.destroyed; },
    isVisible() { return this.visible; },
    isMinimized() { return this.minimized; },
    hide() { this.visible = false; },
    show() { this.visible = true; },
    showInactive() { this.visible = true; },
    restore() { this.minimized = false; this.visible = true; },
    setOpacity(value) { this.opacity = value; },
    getOpacity() { return this.opacity; },
    isAlwaysOnTop() { return this.alwaysOnTop; },
    setAlwaysOnTop(value) { this.alwaysOnTop = !!value; },
    isFocused() { return this.focused; },
    setContentProtection(value) {
      if (this.fail) throw new Error('protection failed');
      this.protected = value;
    },
    isContentProtected() { return this.protected; },
  };
  return win;
}

function harness(platform, release) {
  const windows = [];
  const files = new Map();
  const timers = [];
  const privacy = createScreenSharePrivacy({
    getWindows: () => windows,
    userDataDir: () => 'C:\\FloatGPT-test',
    platform,
    release,
    readFile: (file) => {
      if (!files.has(file)) throw new Error('missing');
      return files.get(file);
    },
    writeFile: (file, data) => files.set(file, data),
    mkdir: () => {},
    schedule: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    cancel: () => {},
  });
  return { privacy, windows, files, timers };
}

{
  const { privacy, windows } = harness('win32', '10.0.26200');
  const first = privacy.load();
  assert.equal(first.excludeFromCapture, false);
  assert.equal(first.status, 'off');
  assert.equal(first.manuallyHidden, false);

  const orb = fakeWindow();
  const popup = fakeWindow();
  windows.push(orb, popup);
  const enabled = privacy.setExcludeFromCapture(true);
  assert.equal(enabled.status, 'enabling');
  assert.equal(orb.protected, true);
  assert.equal(popup.protected, true);

  const child = fakeWindow();
  windows.push(child);
  privacy.protectWindow(child);
  assert.equal(child.protected, true);

  privacy.setExcludeFromCapture(true);
  privacy.setExcludeFromCapture(false);
  privacy.setExcludeFromCapture(true);
  assert.equal(orb.protected, true);
  assert.equal(privacy.getState().excludeFromCapture, true);

  const off = privacy.setExcludeFromCapture(false);
  assert.equal(off.status, 'off');
  assert.equal(orb.protected, false);
  assert.equal(popup.protected, false);
}

{
  const { privacy, windows } = harness('win32', '10.0.18363');
  const orb = fakeWindow();
  windows.push(orb);
  const state = privacy.setExcludeFromCapture(true);
  assert.equal(state.status, 'unsupported');
  assert.equal(orb.protected, false);
  assert.equal(state.excludeFromCapture, true);
}

{
  const { privacy, windows } = harness('win32', '10.0.26200');
  const orb = fakeWindow({ fail: true });
  windows.push(orb);
  const state = privacy.setExcludeFromCapture(true);
  assert.equal(state.status, 'unsupported');
  assert.equal(privacy.getState().status, 'unsupported');
}

{
  const { privacy, windows, files } = harness('win32', '10.0.26200');
  const orb = fakeWindow();
  windows.push(orb);
  privacy.setExcludeFromCapture(true);
  const saved = JSON.parse([...files.values()][0]);
  assert.equal(saved.excludeFromCapture, true);

  const restarted = harness('win32', '10.0.26200');
  restarted.files.set([...files.keys()][0], [...files.values()][0]);
  const again = fakeWindow();
  restarted.windows.push(again);
  const loaded = restarted.privacy.load();
  assert.equal(loaded.excludeFromCapture, true);
  assert.equal(again.protected, true);
  assert.equal(loaded.externalCaptureVerified, false);
}

{
  const { privacy, windows } = harness('win32', '10.0.26200');
  const orb = fakeWindow({ alwaysOnTop: true, focused: true });
  const alreadyHidden = fakeWindow({ visible: false, alwaysOnTop: true });
  windows.push(orb, alreadyHidden);
  privacy.setExcludeFromCapture(true);
  const snap = privacy.beginCaptureHide();
  assert.equal(orb.visible, false);
  assert.equal(alreadyHidden.visible, false);
  privacy.endCaptureHide(snap);
  assert.equal(orb.visible, true);
  assert.equal(orb.protected, true);
  assert.equal(orb.alwaysOnTop, true);
  assert.equal(alreadyHidden.visible, false);

  const snap2 = privacy.beginCaptureHide();
  privacy.hideNow();
  assert.equal(privacy.isManuallyHidden(), true);
  privacy.endCaptureHide(snap2);
  assert.equal(orb.visible, false);
  assert.equal(privacy.getState().excludeFromCapture, true);
  assert.equal(privacy.getState().status, 'hidden');

  assert.equal(orb.opacity, 1);
  privacy.hideNow();
  privacy.restore();
  assert.equal(orb.visible, true);
  assert.equal(orb.opacity, 1);
  assert.equal(alreadyHidden.visible, false);
  assert.equal(privacy.getState().excludeFromCapture, true);
  assert.equal(privacy.isManuallyHidden(), false);
}

{
  const { privacy, windows } = harness('win32', '10.0.26200');
  const orb = fakeWindow({ alwaysOnTop: true });
  windows.push(orb);
  const first = privacy.beginCaptureHide();
  const second = privacy.beginCaptureHide();
  assert.equal(first, second);
  try {
    throw new Error('capture failed');
  } catch {
    privacy.endCaptureHide(first);
  }
  assert.equal(orb.visible, false);
  privacy.endCaptureHide(second);
  assert.equal(orb.visible, true);
  assert.equal(orb.opacity, 1);
  assert.equal(orb.alwaysOnTop, true);
}

console.log('screen share privacy tests passed');
