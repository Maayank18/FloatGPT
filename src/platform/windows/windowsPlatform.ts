import type { IPlatformService, PlatformCapabilities, AppLaunchResult, ScriptExecutionResult, WindowFocusResult } from '../types';

export class WindowsPlatform implements IPlatformService {
  readonly platform = 'win32' as const;
  readonly isWindows = true;
  readonly isMac = false;
  readonly isLinux = false;
  readonly isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

  private get api() {
    return typeof window !== 'undefined' ? (window as any).electronAPI : null;
  }

  getCapabilities(): PlatformCapabilities {
    return {
      supportsOSAutomation: this.isElectron,
      supportsDigitalGuardian: this.isElectron,
      supportsGlobalHotkeys: this.isElectron,
      supportsScreenCanvas: true,
      supportsDesktopCapturer: this.isElectron,
      supportsSystemTray: this.isElectron,
    };
  }

  async getDesktopPath(): Promise<string> {
    return '$([Environment]::GetFolderPath("Desktop"))';
  }

  async getDocumentsPath(): Promise<string> {
    return '$([Environment]::GetFolderPath("MyDocuments"))';
  }

  async getDownloadsPath(): Promise<string> {
    return '$env:USERPROFILE\\Downloads';
  }

  async openApplication(appName: string): Promise<AppLaunchResult> {
    if (!this.api?.flow?.openApp) {
      return { success: false, message: 'Electron desktop environment not available.' };
    }
    const success = await this.api.flow.openApp(appName);
    return {
      success,
      message: success ? `Opened ${appName}` : `Could not open "${appName}". Make sure it is installed on your Windows PC.`,
      app: appName,
    };
  }

  async openURL(url: string): Promise<boolean> {
    if (this.api?.openExternal) {
      return this.api.openExternal(url);
    }
    window.open(url, '_blank');
    return true;
  }

  async openSettings(category = 'home'): Promise<boolean> {
    const categoryMap: Record<string, string> = {
      home: 'ms-settings:',
      display: 'ms-settings:display',
      sound: 'ms-settings:sound',
      bluetooth: 'ms-settings:bluetooth',
      wifi: 'ms-settings:network-wifi',
      keyboard: 'ms-settings:easeofaccess-keyboard',
      apps: 'ms-settings:appsfeatures',
      update: 'ms-settings:windowsupdate',
    };
    const uri = categoryMap[category.toLowerCase()] || 'ms-settings:';
    return this.openURL(uri);
  }

  async focusWindow(titleOrApp: string): Promise<WindowFocusResult> {
    if (!this.api?.flow?.focusWindow) {
      return { success: false, message: 'Window focus requires the desktop app.' };
    }
    const success = await this.api.flow.focusWindow(titleOrApp);
    return {
      success,
      message: success ? `Focused ${titleOrApp}` : `Could not find window "${titleOrApp}"`,
    };
  }

  async executeScript(script: string): Promise<ScriptExecutionResult> {
    if (!this.api?.flow?.executeScript) {
      return { success: false, output: 'Script execution requires the FloatGPT desktop app.' };
    }
    return this.api.flow.executeScript(script);
  }

  async searchWeb(query: string): Promise<boolean> {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    return this.openURL(url);
  }

  async checkPythonAvailable(): Promise<boolean> {
    if (!this.api?.flow?.checkPython) return false;
    return this.api.flow.checkPython();
  }
}
