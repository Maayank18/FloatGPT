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

  desktopContext: {
    glance: (opts?: { includeScreenshot?: boolean; includeFolder?: boolean; forceDesktop?: boolean }) => Promise<{
      ok?: boolean;
      error?: string;
      foreground?: { app?: string; process?: string; title?: string; host?: string | null };
      folder?: { path?: string; items?: string[] } | null;
      screenshot?: string | null;
      openWindows?: string[];
      redacted?: boolean;
      lookedAtSelf?: boolean;
    }>;
  };

  formFill: {
    inspect: () => Promise<{
      ok?: boolean;
      error?: string;
      title?: string;
      hwnd?: number;
      fields?: { index: number; name: string; type?: string; isPassword?: boolean; automationId?: string }[];
    }>;
    fill: (entries: { index: number; value: string }[]) => Promise<{ ok?: boolean; filled?: number; error?: string }>;
  };

  os: {
    snapshot: (kind?: 'ram' | 'cpu' | 'battery' | 'system' | 'all' | 'desktop_folders' | 'screen_recordings' | 'top_processes' | 'ram_hogs' | 'open_taskmgr_and_ram') => Promise<{
      ok?: boolean;
      error?: string;
      hostname?: string;
      platform?: string;
      uptimeSec?: number;
      ram?: { totalGb: number; usedGb: number; freeGb: number; percent: number };
      cpu?: { percent: number; cores: number; model: string };
      battery?: { percent: number; charging: boolean; status?: number; statusText?: string } | null;
      desktopFolders?: { path: string; count: number; folders: string[] };
      screenRecordings?: {
        count: number;
        totalBytes: number;
        totalMb: number;
        totalGb: number;
        locations: { dir: string; count: number }[];
        recent: { name: string; folder: string; sizeMb: number; date: string }[];
      };
      processes?: { name: string; displayName?: string; instances: number; bytes: number; mb: number }[];
      taskManagerOpened?: boolean;
      openedAppName?: string;
    }>;
  };

  tts: {
    speak: (text: string, options?: { voice?: string; rate?: string; pitch?: string }) => Promise<{
      ok: boolean;
      audioBase64?: string;
      mimeType?: string;
      voice?: string;
      error?: string;
      fallback?: string;
    }>;
  };

  media: {
    control: (
      action: 'toggle' | 'play' | 'pause' | 'mute' | 'volume_up' | 'volume_down' | 'next' | 'prev' | 'zoom_in' | 'zoom_out' | 'zoom_reset' | 'switch_tab' | 'prev_tab' | 'switch_app' | 'scroll_down' | 'scroll_up' | 'scroll_top' | 'scroll_bottom' | 'find_on_page',
      opts?: { query?: string; steps?: number }
    ) => Promise<{
      ok: boolean;
      action?: string;
      error?: string;
    }>;
  };

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
    /** Execute arbitrary OS Script safely through the security guard */
    executeScript: (script: string) => Promise<{ success: boolean; output: string }>;
    typeText: (text: string) => Promise<{ ok: boolean; error?: string }>;
    writeUserFile: (opts: {
      folder?: 'desktop' | 'documents';
      name: string;
      content?: string;
      openAfter?: boolean;
    }) => Promise<{ ok: boolean; path?: string; error?: string }>;
  };

  whatsapp: {
    send: (payload: { phone: string; text: string }) => Promise<{ success: boolean; error?: string; qr?: boolean }>;
    status: () => Promise<{ ready?: boolean; loggedIn?: boolean; qr?: boolean; open?: boolean }>;
    openSession: () => Promise<any>;
    closeSession: () => Promise<{ closed?: boolean }>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
