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
  setWindowPosition: (x: number, y: number) => Promise<void>;
  getScreenSize: () => Promise<{ width: number; height: number }>;
  resizeWindow: (params: {
    width: number;
    height: number;
    panelOnLeft: boolean;
    panelOnTop: boolean;
    collapsing: boolean;
  }) => Promise<void>;

  applySettings: (settings: any) => void;

  // ─── Feature 1: Global Hotkey (Summon) ─────────────────────
  /** Subscribe to global hotkey toggle events. Returns an unsubscribe function. */
  onTogglePanel: (callback: () => void) => () => void;

  // ─── Feature 4: Desktop Screenshot Vision ─────────────────
  /** Captures a screenshot. Returns base64 PNG data URL or null. */
  captureScreenshot: () => Promise<string | null>;

  // ─── Feature 5: Multi-Monitor Snap Physics ────────────────
  /** Returns all connected displays. */
  getAllDisplays: () => Promise<DisplayInfo[]>;
  /** Returns the display nearest to the current window center. */
  getNearestDisplay: () => Promise<{ bounds: DisplayInfo['bounds']; workArea: DisplayInfo['workArea'] }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
