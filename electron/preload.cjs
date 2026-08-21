const { contextBridge, ipcRenderer } = require('electron');

/**
 * Exposes a minimal, secure API to the renderer process.
 * The React app accesses this via `window.electronAPI`.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ─── Window Management ───────────────────────────────────────
  /** Get the current window position on screen */
  getWindowPosition: () => ipcRenderer.invoke('electron:get-window-position'),

  /** Set the current window position on screen */
  setWindowPosition: (x, y) => ipcRenderer.send('electron:set-window-position', { x, y }),

  /** Snaps the window securely inside the bounds of the nearest monitor */
  snapToBounds: (orbParams) => ipcRenderer.invoke('electron:snap-to-bounds', orbParams),

  /** Get the primary display work area dimensions */
  getScreenSize: () => ipcRenderer.invoke('electron:get-screen-size'),

  /**
   * Resize and reposition the window.
   * @param {object} params - { width, height, panelOnLeft, panelOnTop, collapsing }
   */
  resizeWindow: (params) => ipcRenderer.invoke('electron:resize-window', params),

  /**
   * Set window to ignore mouse events (make it click-through).
   */
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),

  /** Open a URL in the user's default browser */
  openExternal: (url) => ipcRenderer.invoke('electron:open-external', url),

  /** Forcefully unhide the window if it was hidden via hotkey */
  forceShow: () => ipcRenderer.invoke('electron:force-show'),

  // ─── Settings ─────────────────────────────────────────────────
  /**
   * Apply OS-level settings (startup, always-on-top, hotkeys)
   */
  applySettings: (settings) => ipcRenderer.send('apply-settings', settings),

  // ─── Feature 1: Global Hotkey (Summon) ───────────────────────
  /**
   * Subscribe to the global hotkey toggle event from the main process.
   * The callback fires when the user presses Ctrl+Shift+Space from any app.
   * Returns an unsubscribe function for cleanup.
   */
  onTogglePanel: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('electron:toggle-panel', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('electron:toggle-panel', handler);
  },

  // ─── Feature 4: Desktop Screenshot Vision ───────────────────
  /**
   * Captures a screenshot of the current desktop.
   * Returns a base64-encoded PNG data URL, or null on failure.
   */
  captureScreenshot: () => ipcRenderer.invoke('electron:capture-screenshot'),

  // ─── Feature 5: Multi-Monitor Snap Physics ──────────────────
  /**
   * Returns an array of all connected display objects.
   * Each object contains { id, bounds, workArea, scaleFactor }.
   */
  getAllDisplays: () => ipcRenderer.invoke('electron:get-all-displays'),

  /**
   * Returns the display nearest to the current window center.
   * Contains { bounds, workArea }.
   */
  getNearestDisplay: () => ipcRenderer.invoke('electron:get-nearest-display'),

  // ─── Flow Agent ─────────────────────────────────────────────
  flow: {
    /** Open an application by name */
    openApp: (name) => ipcRenderer.invoke('flow:open-app', name),
    /** Open a URL in the default browser */
    openUrl: (url) => ipcRenderer.invoke('flow:open-url', url),
    /** Search the web using the default browser */
    searchWeb: (query) => ipcRenderer.invoke('flow:search-web', query),
    /** Focus a window by title */
    focusWindow: (title) => ipcRenderer.invoke('flow:focus-window', title),
    /** Check if Python 3 is available */
    checkPython: () => ipcRenderer.invoke('flow:check-python'),
    /** Get Flow agent status */
    getStatus: () => ipcRenderer.invoke('flow:get-status'),
    /** Apply desktop agent settings */
    applyAgentSettings: (settings) => ipcRenderer.send('apply-desktop-agent-settings', settings),
    /** Execute arbitrary OS Script (DANGEROUS) */
    executeScript: (script) => ipcRenderer.invoke('flow:execute-script', script),
  },

  // ─── Digital Guardian ──────────────────────────────────────────
  /** Sync global state to the main process (for Focus Mode) */
  syncState: (state) => ipcRenderer.send('electron:sync-state', state),

  /** Listen for Focus Mode violations from the OS Scanner */
  onGuardianViolation: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('guardian-violation', handler);
    return () => ipcRenderer.removeListener('guardian-violation', handler);
  },
});

