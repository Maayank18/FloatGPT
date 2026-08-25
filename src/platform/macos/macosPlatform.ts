import type { IPlatformService, PlatformCapabilities, AppLaunchResult, ScriptExecutionResult, WindowFocusResult } from '../types';

export class MacOSPlatform implements IPlatformService {
  readonly platform = 'darwin' as const;
  readonly isWindows = false;
  readonly isMac = true;
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
    return '~/Desktop';
  }

  async getDocumentsPath(): Promise<string> {
    return '~/Documents';
  }

  async getDownloadsPath(): Promise<string> {
    return '~/Downloads';
  }

  async openApplication(appName: string): Promise<AppLaunchResult> {
    if (!this.api?.flow?.openApp) {
      return { success: false, message: 'Electron desktop environment not available.' };
    }
    const success = await this.api.flow.openApp(appName);
    return {
      success,
      message: success ? `Opened ${appName}` : `Could not find "${appName}". Make sure it is installed in your /Applications folder.`,
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
    const categoryPaneMap: Record<string, string> = {
      home: 'System Settings',
      display: 'Displays',
      sound: 'Sound',
      bluetooth: 'Bluetooth',
      wifi: 'Network',
      keyboard: 'Keyboard',
      accessibility: 'Accessibility',
      privacy: 'Privacy & Security',
    };
    const pane = categoryPaneMap[category.toLowerCase()] || 'System Settings';
    const script = `osascript -e 'tell application "System Settings" to activate'`;
    const res = await this.executeScript(script);
    return res.success;
  }

  async focusWindow(titleOrApp: string): Promise<WindowFocusResult> {
    if (!this.api?.flow?.focusWindow) {
      return { success: false, message: 'Window focus requires the desktop app.' };
    }
    const success = await this.api.flow.focusWindow(titleOrApp);
    return {
      success,
      message: success ? `Focused ${titleOrApp}` : `Could not find application or window "${titleOrApp}"`,
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
