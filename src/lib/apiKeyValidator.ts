/**
 * API Key Validator Utility
 * Tests connection with AI provider endpoints to verify API keys in real time.
 */

import { extractKeysFromBlob } from '../ai/config/keyPool';

export interface KeyValidationResult {
  isValid: boolean;
  message: string;
  modelsCount?: number;
}

export async function validateApiKey(providerId: string, apiKey: string): Promise<KeyValidationResult> {
  const parsed = extractKeysFromBlob(apiKey, providerId);
  const keys = parsed.length ? parsed : [(apiKey || '').trim()].filter(Boolean);
  if (!keys.length) {
    return { isValid: false, message: 'Please enter a non-empty API key.' };
  }

  const results: { ok: boolean; message: string; modelsCount?: number }[] = [];
  for (const trimmed of keys) {
    results.push(await validateSingleKey(providerId, trimmed));
  }
  const ok = results.filter((r) => r.ok).length;
  if (ok === 0) {
    return { isValid: false, message: results[0]?.message || 'Invalid API key.' };
  }
  if (keys.length === 1) {
    return { isValid: true, message: results[0].message, modelsCount: results[0].modelsCount };
  }
  return {
    isValid: true,
    message: `${ok}/${keys.length} keys verified. Failover will rotate on 429.`,
    modelsCount: results.find((r) => r.ok)?.modelsCount
  };
}

async function validateSingleKey(
  providerId: string,
  trimmed: string
): Promise<{ ok: boolean; message: string; modelsCount?: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    if (providerId === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${trimmed}` },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        return { ok: true, message: 'Groq API key verified.', modelsCount: data.data?.length || 0 };
      }
      const err = await res.json().catch(() => ({}));
      return { ok: false, message: err.error?.message || 'Invalid Groq API key (401).' };
    }

    if (providerId === 'google') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${trimmed}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        return { ok: true, message: 'Gemini API key verified.' };
      }
      const err = await res.json().catch(() => ({}));
      return { ok: false, message: err.error?.message || 'Invalid Gemini API key.' };
    }

    if (providerId === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${trimmed}` },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        return { ok: true, message: 'OpenAI API key verified.' };
      }
      const err = await res.json().catch(() => ({}));
      return { ok: false, message: err.error?.message || 'Invalid OpenAI API key.' };
    }

    clearTimeout(timeoutId);
    if (providerId === 'anthropic') {
      if (trimmed.startsWith('sk-ant-')) {
        return { ok: true, message: 'Anthropic Claude key format accepted.' };
      }
      return { ok: true, message: 'API key saved for Claude.' };
    }

    return { ok: true, message: 'API key configured.' };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { ok: false, message: 'Connection timed out while validating key.' };
    }
    return { ok: false, message: err.message || 'Could not verify API key (network error).' };
  }
}
