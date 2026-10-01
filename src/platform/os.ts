/**
 * FloatGPT — OS & Platform Detection Utility
 */

export function detectPlatform(): 'darwin' | 'win32' | 'linux' {
  if (typeof process !== 'undefined' && process.platform) {
    return process.platform as 'darwin' | 'win32' | 'linux';
  }
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    if (navigator.userAgent.includes('Mac')) return 'darwin';
    if (navigator.userAgent.includes('Win')) return 'win32';
    if (navigator.userAgent.includes('Linux')) return 'linux';
  }
  return 'win32';
}
