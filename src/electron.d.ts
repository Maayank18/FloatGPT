/**
 * TypeScript declarations for the Electron IPC bridge.
 * These types match the API exposed in electron/preload.cjs.
 */

interface DisplayInfo {
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
}

export interface ElectronAPI {
  // ─── Window Management ─────────────────────────────────────
  getWindowPosition: () => Promise<{ x: number; y: number }>;
  setWindowPosition: (x: number, y: number) => void; // Swapped to void since it's IPC send now
  snapToBounds: (orbParams?: { orbX: number, orbY: number, orbSize: number }) => Promise<void>;
  getScreenSize: () => Promise<{ width: number; height: number }>;
  resizeWindow: (params: {
    width: number;
    height: number;
    panelOnLeft: boolean;
    panelOnTop: boolean;
    collapsing: boolean;
    fixedOrb?: boolean;
    currentOrbX?: number;
    currentOrbY?: number;
    newOrbX?: number;
    newOrbY?: number;
  }) => Promise<void>;
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => void;
  openExternal: (url: string) => Promise<boolean>;
  forceShow: () => Promise<void>;

  applySettings: (settings: any) => void;

  // ─── Feature 1: Global Hotkey (Summon) ─────────────────────
  /** Subscribe to global hotkey toggle events. Returns an unsubscribe function. */
  onTogglePanel: (callback: () => void) => () => void;

  // ─── Focus + Sync Handlers ─────────────────────────────────
  syncState: (state: any) => void;
  onGuardianViolation: (callback: (data: any) => void) => () => void;

  // ─── Feature 4: Desktop Screenshot Vision ─────────────────
  /** Captures a screenshot. Returns base64 PNG data URL or null. */
  captureScreenshot: () => Promise<string | null>;

  // ─── Feature 5: Multi-Monitor Snap Physics ────────────────
  /** Returns all connected displays. */
  getAllDisplays: () => Promise<DisplayInfo[]>;
  /** Returns the display nearest to the current window center. */
  getNearestDisplay: () => Promise<{ bounds: DisplayInfo['bounds']; workArea: DisplayInfo['workArea'] }>;

  // ─── Flow Agent ───────────────────────────────────────────
  flow: {
    /** Open an application by name */
    openApp: (name: string) => Promise<boolean>;
    /** Open a URL in the default browser */
    openUrl: (url: string) => Promise<boolean>;
    /** Search the web using the default browser */
    searchWeb: (query: string) => Promise<boolean>;
    /** Focus a window by title */
    focusWindow: (title: string) => Promise<boolean>;
    /** Check if Python 3 is available */
    checkPython: () => Promise<boolean>;
    /** Get Flow agent status */
    getStatus: () => Promise<{ trayMode: boolean; platform: string }>;
    /** Apply desktop agent settings */
    applyAgentSettings: (settings: any) => void;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
