/**
 * Per-key cooldown + last-known quota from provider headers.
 * Fingerprints only — never persist raw API keys.
 */

import { parseQuotaHeaders, parseRetryAfterMs, isRateLimitError } from './rateLimit';

export type KeyQuotaSnapshot = {
  fingerprint: string;
  providerId: string;
  model?: string;
  coolingUntil: number;
  lastError?: string;
  lastStatus?: 'ok' | 'rate_limit' | 'auth' | 'error';
  lastSeenAt: number;
  limitTokens?: number;
  remainingTokens?: number;
  resetTokensAt?: number;
  limitRequests?: number;
  remainingRequests?: number;
  resetRequestsAt?: number;
  sessionPromptTokens: number;
  sessionCompletionTokens: number;
  sessionTotalTokens: number;
  sessionRequests: number;
};

type Listener = () => void;

const listeners = new Set<Listener>();
const store = new Map<string, KeyQuotaSnapshot>();
const lastReadyIndex = new Map<string, number>();

function id(providerId: string, fingerprint: string) {
  return `${providerId}:${fingerprint}`;
}

export function keyFingerprint(key: string): string {
  const t = (key || '').trim();
  if (t.length < 6) return '••••';
  return `…${t.slice(-4)}`;
}

function ensure(providerId: string, fingerprint: string): KeyQuotaSnapshot {
  const k = id(providerId, fingerprint);
  let row = store.get(k);
  if (!row) {
    row = {
      fingerprint,
      providerId,
      coolingUntil: 0,
      lastSeenAt: 0,
      sessionPromptTokens: 0,
      sessionCompletionTokens: 0,
      sessionTotalTokens: 0,
      sessionRequests: 0
    };
    store.set(k, row);
  }
  return row;
}

function emit() {
  listeners.forEach((fn) => {
    try { fn(); } catch {}
  });
}

export function subscribeKeyHealth(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function listKeyHealth(providerId?: string): KeyQuotaSnapshot[] {
  const now = Date.now();
  const rows = [...store.values()].filter((r) => !providerId || r.providerId === providerId);
  for (const r of rows) {
    if (r.coolingUntil && r.coolingUntil <= now && r.lastStatus === 'rate_limit') {
      r.lastStatus = 'ok';
    }
  }
  return rows.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}

export function summarizeProviderHealth(providerId: string, model?: string) {
  const rows = listKeyHealth(providerId);
  const now = Date.now();
  const ready = rows.filter((r) => r.coolingUntil <= now).length;
  const cooling = rows.filter((r) => r.coolingUntil > now).length;
  const sessionTotalTokens = rows.reduce((s, r) => s + r.sessionTotalTokens, 0);
  const sessionPromptTokens = rows.reduce((s, r) => s + r.sessionPromptTokens, 0);
  const sessionCompletionTokens = rows.reduce((s, r) => s + r.sessionCompletionTokens, 0);
  const sessionRequests = rows.reduce((s, r) => s + r.sessionRequests, 0);
  const nextResetAt = rows
    .map((r) => r.coolingUntil || r.resetTokensAt || 0)
    .filter((t) => t > now)
    .sort((a, b) => a - b)[0];
  const withQuota = rows.find((r) => r.limitTokens != null) || rows[0];
  return {
    providerId,
    model,
    keyCount: rows.length,
    ready,
    cooling,
    sessionTotalTokens,
    sessionPromptTokens,
    sessionCompletionTokens,
    sessionRequests,
    nextResetAt,
    limitTokens: withQuota?.limitTokens,
    remainingTokens: withQuota?.remainingTokens,
    limitRequests: withQuota?.limitRequests,
    remainingRequests: withQuota?.remainingRequests
  };
}

export function orderKeysForAttempt(providerId: string, keys: string[]): string[] {
  const now = Date.now();
  const unique = [...new Set(keys.map((k) => k.trim()).filter(Boolean))];
  const ready: string[] = [];
  const cooling: { key: string; until: number }[] = [];
  for (const key of unique) {
    const fp = keyFingerprint(key);
    const row = store.get(id(providerId, fp));
    const until = row?.coolingUntil || 0;
    if (until > now) cooling.push({ key, until });
    else ready.push(key);
  }
  cooling.sort((a, b) => a.until - b.until);
  if (ready.length === 0) return cooling.map((c) => c.key);
  const cursor = (lastReadyIndex.get(providerId) || 0) % ready.length;
  const rotated = [...ready.slice(cursor), ...ready.slice(0, cursor)];
  return [...rotated, ...cooling.map((c) => c.key)];
}

export function noteRateLimit(providerId: string, key: string, errorMessage: string, model?: string, retryAfterHeader?: string | null) {
  const fp = keyFingerprint(key);
  const row = ensure(providerId, fp);
  const wait = parseRetryAfterMs(errorMessage, retryAfterHeader);
  row.coolingUntil = Date.now() + Math.max(wait, 2000);
  row.lastError = errorMessage.slice(0, 300);
  row.lastStatus = 'rate_limit';
  row.model = model || row.model;
  row.lastSeenAt = Date.now();
  if (row.resetTokensAt == null || row.resetTokensAt < row.coolingUntil) {
    row.resetTokensAt = row.coolingUntil;
  }
  emit();
}

export function noteAuthFailure(providerId: string, key: string, errorMessage: string) {
  const row = ensure(providerId, keyFingerprint(key));
  row.lastStatus = 'auth';
  row.lastError = errorMessage.slice(0, 300);
  row.lastSeenAt = Date.now();
  emit();
}

export function observeHttpResponse(
  providerId: string,
  key: string,
  model: string,
  res: Response,
  usage?: { prompt?: number; completion?: number; total?: number }
) {
  const fp = keyFingerprint(key);
  const row = ensure(providerId, fp);
  const q = parseQuotaHeaders(res);
  const now = Date.now();
  row.model = model;
  row.lastSeenAt = now;
  if (q.limitTokens != null) row.limitTokens = q.limitTokens;
  if (q.remainingTokens != null) row.remainingTokens = q.remainingTokens;
  if (q.limitRequests != null) row.limitRequests = q.limitRequests;
  if (q.remainingRequests != null) row.remainingRequests = q.remainingRequests;
  if (q.resetTokensMs != null) row.resetTokensAt = now + q.resetTokensMs;
  if (q.resetRequestsMs != null) row.resetRequestsAt = now + q.resetRequestsMs;
  if (usage) {
    row.sessionPromptTokens += usage.prompt || 0;
    row.sessionCompletionTokens += usage.completion || 0;
    row.sessionTotalTokens += usage.total || (usage.prompt || 0) + (usage.completion || 0);
    row.sessionRequests += 1;
    row.lastStatus = 'ok';
    row.coolingUntil = 0;
  } else if (res.ok) {
    row.sessionRequests += 1;
    row.lastStatus = 'ok';
    row.coolingUntil = 0;
  } else if (isRateLimitError('', res.status)) {
    const wait = q.retryAfterMs || q.resetTokensMs || 15_000;
    row.coolingUntil = now + wait;
    row.lastStatus = 'rate_limit';
    row.resetTokensAt = row.coolingUntil;
  }
  lastReadyIndex.set(providerId, (lastReadyIndex.get(providerId) || 0) + 1);
  emit();
}

export function shortestCooldownMs(providerId: string, keys: string[]): number {
  const now = Date.now();
  let min = Number.POSITIVE_INFINITY;
  for (const key of keys) {
    const row = store.get(id(providerId, keyFingerprint(key)));
    const left = (row?.coolingUntil || 0) - now;
    if (left > 0 && left < min) min = left;
  }
  return Number.isFinite(min) ? min : 0;
}

export function formatReset(at?: number): string {
  if (!at) return '—';
  const left = at - Date.now();
  if (left <= 0) return 'now';
  const s = Math.ceil(left / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function resetSessionUsage(providerId?: string) {
  for (const row of store.values()) {
    if (providerId && row.providerId !== providerId) continue;
    row.sessionPromptTokens = 0;
    row.sessionCompletionTokens = 0;
    row.sessionTotalTokens = 0;
    row.sessionRequests = 0;
  }
  emit();
}
