/**
 * Resolves the full API key pool for a provider from user settings and env.
 * Supports numbered keys (VITE_GROQ_API_KEY_2 … _20) and multiple keys
 * pasted into a single settings field (newlines, commas, or raw gsk_/sk- tokens).
 */

export function resolveProviderKeyPool(
  providerId: string,
  userKey?: string,
  overrideFallbacks?: string[]
): { primaryKey: string; fallbackKeys: string[] } {
  const upper = providerId.toUpperCase();
  let env: Record<string, any> = {};
  try {
    if (typeof process !== 'undefined' && process.env) {
      env = { ...env, ...process.env };
    }
  } catch {}
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta?.env) {
      // @ts-ignore
      env = { ...env, ...import.meta.env };
    }
  } catch {}

  const pool: string[] = [];
  const addKey = (k?: string) => {
    if (k && typeof k === 'string' && k.trim() !== '' && !pool.includes(k.trim())) {
      pool.push(k.trim());
    }
  };

  extractKeysFromBlob(userKey, providerId).forEach(addKey);

  if (overrideFallbacks && overrideFallbacks.length > 0) {
    overrideFallbacks.forEach((k) => extractKeysFromBlob(k, providerId).forEach(addKey));
  }

  // Statically reference Vite env keys to ensure zero bundler tree-shaking
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta?.env) {
      if (providerId === 'groq') {
        addKey(import.meta.env.VITE_GROQ_API_KEY);
        addKey(import.meta.env.VITE_GROQ_API_KEY_2);
        addKey(import.meta.env.VITE_GROQ_API_KEY_3);
        addKey(import.meta.env.VITE_GROQ_API_KEY_4);
        addKey(import.meta.env.VITE_GROQ_API_KEY_5);
        addKey(import.meta.env.VITE_GROQ_API_KEY_6);
        addKey(import.meta.env.VITE_GROQ_API_KEY_7);
        addKey(import.meta.env.VITE_GROQ_API_KEY_8);
        addKey(import.meta.env.VITE_GROQ_API_KEY_9);
        addKey(import.meta.env.VITE_GROQ_API_KEY_10);
      } else if (providerId === 'openai') {
        addKey(import.meta.env.VITE_OPENAI_API_KEY);
        addKey(import.meta.env.VITE_OPENAI_API_KEY_2);
        addKey(import.meta.env.VITE_OPENAI_API_KEY_3);
      } else if (providerId === 'google') {
        addKey(import.meta.env.VITE_GEMINI_API_KEY);
        addKey(import.meta.env.VITE_GOOGLE_API_KEY);
      } else if (providerId === 'anthropic') {
        addKey(import.meta.env.VITE_ANTHROPIC_API_KEY);
      }
    }
  } catch {}

  const envNameVariants = (index?: number) => {
    const suffix = index ? `_${index}` : '';
    const names = [
      `VITE_${upper}_API_KEY${suffix}`,
      `${upper}_API_KEY${suffix}`
    ];
    if (providerId === 'google') {
      names.push(`VITE_GEMINI_API_KEY${suffix}`, `GEMINI_API_KEY${suffix}`);
    }
    return names;
  };

  envNameVariants().forEach((name) => addKey(env[name]));
  envNameVariants(1).forEach((name) => addKey(env[name]));
  for (let i = 2; i <= 20; i++) {
    envNameVariants(i).forEach((name) => addKey(env[name]));
  }

  for (const [keyName, keyVal] of Object.entries(env)) {
    if (
      typeof keyVal === 'string' &&
      keyVal.trim() !== '' &&
      keyName.includes('API_KEY') &&
      (keyName.includes(upper) || (providerId === 'google' && keyName.includes('GEMINI')))
    ) {
      extractKeysFromBlob(keyVal, providerId).forEach(addKey);
    }
  }

  const [primaryKey, ...fallbackKeys] = pool;
  return {
    primaryKey: primaryKey || '',
    fallbackKeys: fallbackKeys || []
  };
}

/**
 * Resolves the primary key pool, automatically failing over to other providers
 * if the requested provider has no active keys configured.
 */
export function getAvailableProviderPool(
  preferredProvider: string = 'groq',
  userConfig?: { apiKeys?: Record<string, string> }
): { providerId: string; primaryKey: string; fallbackKeys: string[] } {
  // 1. Try preferred provider first
  const preferredKey = userConfig?.apiKeys?.[preferredProvider];
  const preferredPool = resolveProviderKeyPool(preferredProvider, preferredKey);
  if (preferredPool.primaryKey) {
    return { providerId: preferredProvider, ...preferredPool };
  }

  // 2. Fall back to other providers with active keys in priority order
  const priorityOrder = ['groq', 'openai', 'anthropic', 'google'].filter((p) => p !== preferredProvider);
  for (const provider of priorityOrder) {
    const key = userConfig?.apiKeys?.[provider];
    const pool = resolveProviderKeyPool(provider, key);
    if (pool.primaryKey) {
      return { providerId: provider, ...pool };
    }
  }

  return { providerId: preferredProvider, primaryKey: '', fallbackKeys: [] };
}

export function extractKeysFromBlob(raw: string | undefined, providerId: string): string[] {
  if (!raw || typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (providerId === 'groq') {
    const groq = trimmed.match(/gsk_[A-Za-z0-9_-]+/g);
    if (groq && groq.length > 0) return unique(groq);
  }
  if (providerId === 'openai' || providerId === 'anthropic') {
    const sk = trimmed.match(/sk(?:-ant)?-[A-Za-z0-9_\-]+/g);
    if (sk && sk.length > 1) return unique(sk);
  }
  if (providerId === 'google') {
    const google = trimmed.match(/AIza[A-Za-z0-9_\-]+/g);
    if (google && google.length > 1) return unique(google);
  }

  return unique(
    trimmed
      .split(/[\n\r,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 8 && !s.startsWith('#'))
  );
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}
