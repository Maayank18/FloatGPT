/**
 * Platform Types & Interfaces — FloatGPT Platform Abstraction Layer
 * Defines platform-agnostic contracts for OS operations, window management, and system services.
 */

export type SupportedPlatform = 'win32' | 'darwin' | 'linux' | 'web';

export interface PlatformPaths {
  desktop: string;
  documents: string;
  downloads: string;
  userData: string;
  appData: string;
  temp: string;
  home: string;
}

export interface AppLaunchResult {
  success: boolean;
  message: string;
  app?: string;
}

export interface ScriptExecutionResult {
  success: boolean;
  output: string;
  exitCode?: number;
}

export interface WindowFocusResult {
  success: boolean;
  message: string;
}

export interface PlatformCapabilities {
  supportsOSAutomation: boolean;
  supportsDigitalGuardian: boolean;
  supportsGlobalHotkeys: boolean;
  supportsScreenCanvas: boolean;
  supportsDesktopCapturer: boolean;
  supportsSystemTray: boolean;
}

export interface IPlatformService {
  readonly platform: SupportedPlatform;
  readonly isWindows: boolean;
  readonly isMac: boolean;
  readonly isLinux: boolean;
  readonly isElectron: boolean;

  getCapabilities(): PlatformCapabilities;
  getDesktopPath(): Promise<string>;
  getDocumentsPath(): Promise<string>;
  getDownloadsPath(): Promise<string>;

  openApplication(appName: string): Promise<AppLaunchResult>;
  openURL(url: string): Promise<boolean>;
  openSettings(category?: string): Promise<boolean>;
  focusWindow(titleOrApp: string): Promise<WindowFocusResult>;
  executeScript(script: string): Promise<ScriptExecutionResult>;
  searchWeb(query: string): Promise<boolean>;
  checkPythonAvailable(): Promise<boolean>;
}
