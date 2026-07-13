const { app, BrowserWindow, ipcMain, screen, globalShortcut, desktopCapturer, powerMonitor } = require('electron');
const path = require('path');

// ─── Constants ──────────────────────────────────────────────
const ORB_ELEMENT_SIZE = 56; // Matches w-14 (3.5rem) in Tailwind
const ORB_PAD = 8; // Increased padding to prevent glowing border/box-shadow clipping
const COLLAPSED_SIZE = ORB_ELEMENT_SIZE + ORB_PAD * 2; // 72px

let mainWindow = null;
let currentHotkey = 'CommandOrControl+Shift+Space';

const registerSummonHotkey = (hotkey) => {
  try {
    globalShortcut.unregister(currentHotkey);
    globalShortcut.register(hotkey, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    currentHotkey = hotkey;
    console.log(`[FloatGPT] Global hotkey registered: Summon (${hotkey})`);
  } catch (err) {
    console.warn(`[FloatGPT] Failed to register global hotkey:`, err.message);
  }
};

// ─── Window Creation ────────────────────────────────────────
const net = require('net');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function createWindow(serverUrl) {
  const { width: screenW, height: screenH } =
    screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: COLLAPSED_SIZE,
    height: COLLAPSED_SIZE,
    x: screenW - COLLAPSED_SIZE - 40,
    y: screenH - COLLAPSED_SIZE - 40,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false, // Prevent invisible window bug on Windows
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      zoomFactor: 1.0,
    },
  });

  // Aggressive Always-on-Top enforcement
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
       // Force window to remain on top even when clicking away
       mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }
  });

  mainWindow.loadURL(serverUrl);

  // ─── Prevent Window Zooming ─────────────────────────────────
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomFactor(1.0);
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
  });
  mainWindow.webContents.on('zoom-changed', (event) => {
    event.preventDefault();
  });
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control || input.meta) {
      if (['+', '=', '-'].includes(input.key)) {
        event.preventDefault();
      }
    }
  });

  // Force paint before showing to fix Windows transparency rendering bugs
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── App Lifecycle ──────────────────────────────────────────
// On Linux, hardware acceleration must be disabled for transparency
if (process.platform === 'linux') {
  app.disableHardwareAcceleration();
}

app.whenReady().then(async () => {
  let serverUrl = process.env.ELECTRON_DEV_URL || 'http://localhost:3000';
  
  if (app.isPackaged) {
    const port = await getFreePort();
    process.env.FLOATGPT_PORT = port;
    process.env.NODE_ENV = 'production';
    
    try {
      require(path.join(__dirname, '../dist/server.cjs'));
      serverUrl = `http://localhost:${port}`;
      console.log(`[FloatGPT] Internal Express server spawned on port ${port}`);
    } catch (err) {
      console.error('[FloatGPT] Failed to start internal Express server:', err);
    }
  }

  createWindow(serverUrl);

  // ─── Feature 1: Global Hotkey (Summon) ──────────────────────
  registerSummonHotkey(currentHotkey);

  // ─── Aggressive Sleep/Wake Recovery ─────────────────────────
  powerMonitor.on('suspend', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
  });

  powerMonitor.on('resume', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Re-apply top-level settings after waking from sleep
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      
      // Force a tiny resize to force Windows DWM to repaint the transparent window
      const bounds = mainWindow.getBounds();
      mainWindow.setBounds({ width: bounds.width + 1, height: bounds.height + 1 });
      
      mainWindow.showInactive();
      
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setBounds(bounds);
          mainWindow.setOpacity(0.99);
          mainWindow.show();
          setTimeout(() => mainWindow.setOpacity(1), 50);
        }
      }, 50);
    }
  });
});

app.on('will-quit', () => {
  // Unregister all global shortcuts to prevent OS-level leaks
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // If reactivating (e.g. macOS dock), we assume the internal server is already running,
    // so we can just reuse the env variable.
    const port = process.env.FLOATGPT_PORT || 3000;
    createWindow(`http://localhost:${port}`);
  }
});

// ─── IPC Handlers ───────────────────────────────────────────

ipcMain.on('apply-settings', (event, settings) => {
  if (!settings) return;
  
  try {
    // 1. Launch on Startup
    app.setLoginItemSettings({
      openAtLogin: settings.system?.launchOnStartup === true,
      openAsHidden: true
    });

    // 2. Always on Top
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(settings.system?.alwaysOnTop === true, 'screen-saver');
    }

    // 3. Global Hotkey
    if (settings.system?.globalHotkey && settings.system.globalHotkey !== currentHotkey) {
      registerSummonHotkey(settings.system.globalHotkey);
    }

    // 4. Focus Mode Web Blocker (Intercepts internal Electron requests)
    const { session } = require('electron');
    if (settings.features?.focusModeEnabled && settings.productivity?.focusBlocklist) {
      const blocklist = settings.productivity.focusBlocklist;
      session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        const url = details.url.toLowerCase();
        const shouldBlock = blocklist.some(domain => url.includes(domain.toLowerCase()));
        if (shouldBlock) {
          console.log(`[Focus Mode] Blocked request to: ${url}`);
          callback({ cancel: true });
        } else {
          callback({ cancel: false });
        }
      });
    } else {
      // Clear interceptor
      session.defaultSession.webRequest.onBeforeRequest(null);
    }

  } catch (err) {
    console.error('[FloatGPT] Error applying settings:', err);
  }
});

/**
 * Returns the current window position on screen.
 */
ipcMain.handle('electron:get-window-position', () => {
  if (!mainWindow) return { x: 0, y: 0 };
  const [x, y] = mainWindow.getPosition();
  return { x, y };
});

/**
 * Sets the current window position on screen.
 */
ipcMain.handle('electron:set-window-position', (_event, { x, y }) => {
  if (!mainWindow) return;
  mainWindow.setPosition(Math.round(x), Math.round(y));
});

/**
 * Returns the primary display work area dimensions.
 */
ipcMain.handle('electron:get-screen-size', () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return { width, height };
});

// ─── Feature 5: Multi-Monitor Snap Physics ────────────────────
/**
 * Returns all connected displays with their bounds and work areas.
 */
ipcMain.handle('electron:get-all-displays', () => {
  return screen.getAllDisplays().map(d => ({
    id: d.id,
    bounds: d.bounds,
    workArea: d.workArea,
    scaleFactor: d.scaleFactor,
  }));
});

/**
 * Returns the display nearest to the current window center.
 */
ipcMain.handle('electron:get-nearest-display', () => {
  if (!mainWindow) {
    const primary = screen.getPrimaryDisplay();
    return { bounds: primary.bounds, workArea: primary.workArea };
  }
  const [wx, wy] = mainWindow.getPosition();
  const [ww, wh] = mainWindow.getSize();
  const centerX = wx + Math.round(ww / 2);
  const centerY = wy + Math.round(wh / 2);
  const nearest = screen.getDisplayNearestPoint({ x: centerX, y: centerY });
  return { bounds: nearest.bounds, workArea: nearest.workArea };
});

/**
 * Resizes and repositions the window so the orb stays at its
 * current screen position while the panel expands/collapses.
 * Now uses the NEAREST display instead of always the primary display.
 */
ipcMain.handle('electron:resize-window', (_event, params) => {
  if (!mainWindow) return;

  const { width, height, panelOnLeft, panelOnTop, collapsing } = params;
  const [currentX, currentY] = mainWindow.getPosition();
  const [currentW, currentH] = mainWindow.getSize();

  // Use the nearest display for multi-monitor awareness
  const centerX = currentX + Math.round(currentW / 2);
  const centerY = currentY + Math.round(currentH / 2);
  const nearestDisplay = screen.getDisplayNearestPoint({ x: centerX, y: centerY });
  const { x: areaX, y: areaY, width: screenW, height: screenH } = nearestDisplay.workArea;

  let newX = currentX;
  let newY = currentY;

  if (collapsing) {
    if (panelOnLeft) newX = currentX + (currentW - width);
    if (panelOnTop) newY = currentY + (currentH - height);
  } else {
    if (panelOnLeft) newX = currentX - (width - currentW);
    if (panelOnTop) newY = currentY - (height - currentH);
  }

  // Clamp to the nearest display's work area bounds (not just primary)
  newX = Math.max(areaX, Math.min(newX, areaX + screenW - width));
  newY = Math.max(areaY, Math.min(newY, areaY + screenH - height));

  mainWindow.setBounds({
    x: Math.round(newX),
    y: Math.round(newY),
    width: Math.round(width),
    height: Math.round(height),
  });
});

// ─── Feature 4: Desktop Screenshot Vision ─────────────────────
/**
 * Captures a screenshot of the primary screen.
 * Temporarily hides the FloatGPT window so it doesn't capture itself.
 * Returns a base64-encoded PNG data URL.
 */
ipcMain.handle('electron:capture-screenshot', async () => {
  if (!mainWindow) return null;

  try {
    // We intentionally DO NOT hide the window here anymore, per user request.
    // The orb will remain fully visible and may be captured in the screenshot,
    // guaranteeing it never randomly disappears.

    // Small delay to let the OS finish hiding the window
    await new Promise(resolve => setTimeout(resolve, 150));

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    // No need to restore opacity since we never hid it
    mainWindow.focus();

    if (sources.length === 0) return null;

    // Use the first screen source (primary display)
    const screenshot = sources[0].thumbnail.toDataURL();
    return screenshot;
  } catch (err) {
    console.error('[FloatGPT] Screenshot capture failed:', err);
    // Make sure we restore focus even on error
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }
    return null;
  }
});
