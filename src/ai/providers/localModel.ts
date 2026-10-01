/**
 * Local open model for a clone with no API key.
 * One pull stores the weights on disk. Each `npm run dev` talks to Ollama.
 */

import { getAvailableProviderPool } from '../config/keyPool';

export const LOCAL_PROVIDER_ID = 'ollama';
export const LOCAL_MODEL_ID = 'qwen3.5:9b';
export const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
/** Sentinel so the cloud key loop still runs. Ollama ignores it. */
export const LOCAL_API_SENTINEL = 'local';

/** Short context keeps the GPU cache small so the browser stays responsive. */
export const LOCAL_NUM_CTX = 8192;
/** Unload after idle so closing the terminal frees the GPU. */
export const LOCAL_KEEP_ALIVE = '30m';

/** A slow or failed local reply must not be reported as "Ollama is not installed". */
export function localFailureMessage(detail: string): string {
  const text = String(detail || '');
  if (/took too long/i.test(text)) {
    return 'Qwen is on this PC, but it did not answer in time. Ask again in a moment.';
  }
  if (/ECONNREFUSED|fetch failed|Failed to fetch|unable to connect|other side closed|network/i.test(text)) {
    return localModelSetupMessage();
  }
  const inner = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/AI Service Error|Keys tried/i.test(line));
  return inner.join('\n') || localModelSetupMessage();
}

export function localModelSetupMessage(): string {
  return [
    'The local model is not ready on this PC.',
    '',
    'One time:',
    '1. Install Ollama from https://ollama.com',
    '2. Run `ollama pull qwen3.5:9b`',
    '3. Run `npm i` in this repo',
    '',
    'After that, each day is only `npm run dev`. The model stays on disk. No API key.'
  ].join('\n');
}

export interface ChatRouteInput {
  requestedProvider?: string;
  overrideProviderId?: string;
  overrideApiKey?: string;
  poolProviderId: string;
  primaryKey?: string;
}

export interface ChatRoute {
  providerId: string;
  apiKey: string;
  local: boolean;
  model?: string;
}

/** True when this chat will run on Qwen instead of a cloud key. */
export function usesLocalChat(state?: { settings?: { aiConfig?: { selectedProvider?: string; apiKeys?: Record<string, string> } } }): boolean {
  const selected = state?.settings?.aiConfig?.selectedProvider;
  if (selected === LOCAL_PROVIDER_ID) return true;
  const pool = getAvailableProviderPool(selected || 'groq', { apiKeys: state?.settings?.aiConfig?.apiKeys });
  return !pool.primaryKey;
}

/** Cloud when a real key exists. Otherwise the local Qwen model. */
export function resolveChatRoute(input: ChatRouteInput): ChatRoute {
  const requested = input.overrideProviderId || input.requestedProvider;
  if (requested === LOCAL_PROVIDER_ID) {
    return {
      providerId: LOCAL_PROVIDER_ID,
      apiKey: LOCAL_API_SENTINEL,
      local: true,
      model: LOCAL_MODEL_ID
    };
  }

  const key = String(input.overrideApiKey || input.primaryKey || '').trim();
  if (key && key !== LOCAL_API_SENTINEL) {
    return {
      providerId: input.overrideProviderId || input.poolProviderId,
      apiKey: key,
      local: false
    };
  }

  return {
    providerId: LOCAL_PROVIDER_ID,
    apiKey: LOCAL_API_SENTINEL,
    local: true,
    model: LOCAL_MODEL_ID
  };
}

let readyUntil = 0;

/** True when Ollama is up and qwen3.5:9b is already pulled. */
export async function inspectLocalModel(): Promise<{ ok: boolean; message: string }> {
  if (Date.now() < readyUntil) {
    return { ok: true, message: '' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      return { ok: false, message: localModelSetupMessage() };
    }
    const data = await res.json();
    const names: string[] = Array.isArray(data?.models)
      ? data.models.map((model: { name?: string }) => String(model?.name || ''))
      : [];
    const ready = names.some((name) => name === LOCAL_MODEL_ID || name.startsWith(`${LOCAL_MODEL_ID}`));
    if (!ready) {
      return { ok: false, message: localModelSetupMessage() };
    }
    readyUntil = Date.now() + 60_000;
    return { ok: true, message: '' };
  } catch {
    clearTimeout(timeout);
    return { ok: false, message: localModelSetupMessage() };
  }
}
