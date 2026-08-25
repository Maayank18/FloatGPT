import type { IPlatformService, SupportedPlatform } from './types';
import { WindowsPlatform } from './windows/windowsPlatform';
import { MacOSPlatform } from './macos/macosPlatform';
import { WebPlatform } from './web/webPlatform';

export * from './types';

/**
 * Detects current runtime platform safely across Electron main, preload, and browser renderers.
 */
export function detectPlatform(): SupportedPlatform {
  if (typeof process !== 'undefined' && process.platform) {
    if (process.platform === 'darwin') return 'darwin';
    if (process.platform === 'win32') return 'win32';
    if (process.platform === 'linux') return 'linux';
  }

  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    // We can infer from userAgent or navigator platform
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('mac')) return 'darwin';
    if (userAgent.includes('win')) return 'win32';
    if (userAgent.includes('linux')) return 'linux';
  }

  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase();
    const plat = (navigator.platform || '').toLowerCase();
    if (plat.includes('mac') || ua.includes('mac')) return 'darwin';
    if (plat.includes('win') || ua.includes('win')) return 'win32';
    if (plat.includes('linux') || ua.includes('linux')) return 'linux';
  }

  return 'web';
}

let platformInstance: IPlatformService | null = null;

/**
 * Returns the singleton platform service instance appropriate for the current runtime.
 */
export function getPlatform(): IPlatformService {
  if (!platformInstance) {
    const plat = detectPlatform();
    if (plat === 'darwin') {
      platformInstance = new MacOSPlatform();
    } else if (plat === 'win32') {
      platformInstance = new WindowsPlatform();
    } else if (typeof window !== 'undefined' && (window as any).electronAPI) {
      platformInstance = new WindowsPlatform();
    } else {
      platformInstance = new WebPlatform();
    }
  }
  return platformInstance;
}

export const platform = getPlatform();
