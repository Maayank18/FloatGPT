/**
 * FloatGPT Universal Clipboard Helper
 *
 * Provides a resilient multi-tier clipboard copy and read mechanism:
 * 1. Native Electron IPC (highest reliability, bypasses document focus and browser permission blocks)
 * 2. Modern Async Clipboard API (navigator.clipboard)
 * 3. Fallback synchronous document.execCommand('copy') via off-screen element
 */

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof text !== 'string') {
    text = String(text ?? '');
  }

  // 1. Electron Native IPC (Bypasses window focus & permission limitations)
  try {
    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (api?.clipboard?.writeText) {
      const res = await api.clipboard.writeText(text);
      if (res?.ok !== false) return true;
    }
  } catch (err) {
    console.warn('[clipboard] Electron native writeText failed, falling back:', err);
  }

  // 2. Modern navigator.clipboard API
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('[clipboard] navigator.clipboard.writeText failed, falling back:', err);
  }

  // 3. Document execCommand fallback
  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) return true;
    }
  } catch (err) {
    console.error('[clipboard] execCommand copy failed:', err);
  }

  return false;
}

export async function readFromClipboard(): Promise<string> {
  // 1. Electron Native IPC
  try {
    const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (api?.clipboard?.readText) {
      const text = await api.clipboard.readText();
      if (typeof text === 'string') return text;
    }
  } catch (err) {
    console.warn('[clipboard] Electron native readText failed, falling back:', err);
  }

  // 2. Modern navigator.clipboard API
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      return await navigator.clipboard.readText();
    }
  } catch (err) {
    console.warn('[clipboard] navigator.clipboard.readText failed:', err);
  }

  return '';
}
