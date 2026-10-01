/**
 * Honest rate-limit / quota parsing for Groq, OpenAI, Gemini.
 * Never treat "rate limit reached for model X" as "model unavailable".
 */

export function isRateLimitError(errorMessage: string, status?: number): boolean {
  if (status === 429) return true;
  const lower = (errorMessage || '').toLowerCase();
  if (!lower) return false;
  if (/\b429\b/.test(lower) || lower.includes('http_429')) return true;
  if (lower.includes('rate_limit_exceeded') || lower.includes('rate limit reached')) return true;
  if (lower.includes('resource_exhausted') || lower.includes('resource exhausted')) return true;
  if (lower.includes('too many requests')) return true;
  if (lower.includes('tokens per minute') || lower.includes('tokens per day')) return true;
  if (lower.includes('requests per minute') || /\btpm\b/.test(lower) || /\btpd\b/.test(lower) || /\brpm\b/.test(lower)) {
    return lower.includes('limit') || lower.includes('exceed') || lower.includes('rate');
  }
  if (lower.includes('try again in') && (lower.includes('rate') || lower.includes('limit') || lower.includes('quota'))) {
    return true;
  }
  return false;
}

export function isModelUnavailableError(errorMessage: string): boolean {
  if (isRateLimitError(errorMessage)) return false;
  const lower = (errorMessage || '').toLowerCase();
  return (
    lower.includes('model_not_found') ||
    lower.includes('decommissioned') ||
    /model .* does not exist/.test(lower) ||
    lower.includes('not found for model') ||
    lower.includes('model does not exist')
  );
}

export function isAuthError(errorMessage: string, status?: number): boolean {
  if (isRateLimitError(errorMessage, status)) return false;
  if (status === 401 || status === 403) return true;
  const lower = (errorMessage || '').toLowerCase();
  return (
    lower.includes('invalid api key') ||
    lower.includes('invalid_api_key') ||
    lower.includes('incorrect api key') ||
    (lower.includes('401') && (lower.includes('auth') || lower.includes('key'))) ||
    (lower.includes('authentication') && !lower.includes('rate'))
  );
}

/** Parse Groq "Please try again in 7m12.54s" and Retry-After headers. */
export function parseRetryAfterMs(errorMessage: string, retryAfterHeader?: string | null): number {
  if (retryAfterHeader) {
    const trimmed = retryAfterHeader.trim();
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum) && asNum >= 0) {
      return asNum > 1000 ? asNum : asNum * 1000;
    }
    const fromDuration = parseDurationMs(trimmed);
    if (fromDuration > 0) return fromDuration;
    const dateMs = Date.parse(trimmed);
    if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  }
  const msg = errorMessage || '';
  const groq = msg.match(/try again in\s+((?:\d+h)?\s*(?:\d+m)?\s*(?:\d+(?:\.\d+)?s)?)/i);
  if (groq) {
    const ms = parseDurationMs(groq[1]);
    if (ms > 0) return ms;
  }
  const gemini = msg.match(/retryDelay["'\s:]*([0-9.]+s)/i);
  if (gemini) return parseDurationMs(gemini[1]);
  return 15_000;
}

export function parseDurationMs(raw: string): number {
  if (!raw) return 0;
  const s = raw.trim().toLowerCase();
  let ms = 0;
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  const sec = s.match(/(\d+(?:\.\d+)?)\s*s/);
  if (h) ms += parseInt(h[1], 10) * 3600_000;
  if (m) ms += parseInt(m[1], 10) * 60_000;
  if (sec) ms += parseFloat(sec[1]) * 1000;
  if (ms === 0 && /^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    ms = n > 1000 ? n : n * 1000;
  }
  return Math.round(ms);
}

export function header(res: { headers?: { get: (n: string) => string | null } } | null, name: string): string | null {
  try {
    return res?.headers?.get(name) || res?.headers?.get(name.toLowerCase()) || null;
  } catch {
    return null;
  }
}

export function parseQuotaHeaders(res: { headers?: { get: (n: string) => string | null } } | null): {
  limitRequests?: number;
  remainingRequests?: number;
  resetRequestsMs?: number;
  limitTokens?: number;
  remainingTokens?: number;
  resetTokensMs?: number;
  retryAfterMs?: number;
} {
  if (!res?.headers) return {};
  const num = (n: string) => {
    const v = header(res, n);
    if (v == null || v === '') return undefined;
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const dur = (n: string) => {
    const v = header(res, n);
    if (!v) return undefined;
    const ms = parseDurationMs(v);
    return ms > 0 ? ms : undefined;
  };
  const retryRaw = header(res, 'retry-after');
  return {
    limitRequests: num('x-ratelimit-limit-requests'),
    remainingRequests: num('x-ratelimit-remaining-requests'),
    resetRequestsMs: dur('x-ratelimit-reset-requests'),
    limitTokens: num('x-ratelimit-limit-tokens'),
    remainingTokens: num('x-ratelimit-remaining-tokens'),
    resetTokensMs: dur('x-ratelimit-reset-tokens'),
    retryAfterMs: retryRaw ? parseRetryAfterMs('', retryRaw) : undefined
  };
}

export async function readHttpError(res: Response, providerLabel: string): Promise<string> {
  let msg = `${providerLabel} API Error: ${res.status} ${res.statusText}`;
  let code = '';
  try {
    const errorData = await res.json();
    msg = errorData.error?.message || errorData.message || msg;
    code = String(errorData.error?.code || errorData.error?.type || errorData.error?.status || '');
    const retryDelay = errorData.error?.details?.find?.((d: any) => d.retryDelay)?.retryDelay;
    if (retryDelay) msg += ` (retryDelay ${retryDelay})`;
  } catch {}
  return `HTTP_${res.status} ${code} ${msg}`.trim();
}
