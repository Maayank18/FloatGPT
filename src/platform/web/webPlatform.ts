import type { IPlatformService, PlatformCapabilities, AppLaunchResult, ScriptExecutionResult, WindowFocusResult } from '../types';

export class WebPlatform implements IPlatformService {
  readonly platform = 'web' as const;
  readonly isWindows = false;
  readonly isMac = false;
  readonly isLinux = false;
  readonly isElectron = false;

  getCapabilities(): PlatformCapabilities {
    return {
      supportsOSAutomation: false,
      supportsDigitalGuardian: false,
      supportsGlobalHotkeys: false,
      supportsScreenCanvas: true,
      supportsDesktopCapturer: false,
      supportsSystemTray: false,
    };
  }

  async getDesktopPath(): Promise<string> {
    return 'Desktop';
  }

  async getDocumentsPath(): Promise<string> {
    return 'Documents';
  }

  async getDownloadsPath(): Promise<string> {
    return 'Downloads';
  }

  async openApplication(appName: string): Promise<AppLaunchResult> {
    return {
      success: false,
      message: `Direct OS application launch (${appName}) is only available in the FloatGPT Desktop app.`,
      app: appName,
    };
  }

  async openURL(url: string): Promise<boolean> {
    window.open(url, '_blank');
    return true;
  }

  async openSettings(_category = 'home'): Promise<boolean> {
    return false;
  }

  async focusWindow(_titleOrApp: string): Promise<WindowFocusResult> {
    return { success: false, message: 'Window focus requires the FloatGPT desktop app.' };
  }

  async executeScript(_script: string): Promise<ScriptExecutionResult> {
    return { success: false, output: 'Direct OS script execution requires the FloatGPT Desktop app.' };
  }

  async searchWeb(query: string): Promise<boolean> {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
    return true;
  }

  async checkPythonAvailable(): Promise<boolean> {
    return false;
  }
}
