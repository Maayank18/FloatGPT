import React, { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { resolveProviderKeyPool } from '../../ai/config/keyPool';
import {
  formatReset,
  keyFingerprint,
  listKeyHealth,
  resetSessionUsage,
  subscribeKeyHealth,
  summarizeProviderHealth,
  type KeyQuotaSnapshot
} from '../../ai/config/keyHealth';

function fmt(n?: number) {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString();
}

export function ApiQuotaPanel({
  providerId,
  model,
  keyBlob
}: {
  providerId: string;
  model?: string;
  keyBlob?: string;
}) {
  const [, setTick] = useState(0);

  useEffect(() => subscribeKeyHealth(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  const pool = resolveProviderKeyPool(providerId, keyBlob);
  const poolKeys = [pool.primaryKey, ...pool.fallbackKeys].filter(Boolean);
  const poolCount = poolKeys.length;
  const summary = summarizeProviderHealth(providerId, model);
  const rows: KeyQuotaSnapshot[] = listKeyHealth(providerId);
  const known = new Set(rows.map((r) => r.fingerprint));
  const placeholders = poolKeys
    .map((k) => keyFingerprint(k))
    .filter((fp) => !known.has(fp));

  const usedTokens =
    summary.limitTokens != null && summary.remainingTokens != null
      ? Math.max(0, summary.limitTokens - summary.remainingTokens)
      : null;

  return (
    <div className="rounded-xl border border-card-border bg-bg-secondary/50 p-2.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Activity className="w-3 h-3 text-accent shrink-0" />
          <p className="text-[10px] font-bold text-text-primary truncate">
            {providerId.toUpperCase()} quota · {model || 'active model'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => resetSessionUsage(providerId)}
          className="text-[9px] text-text-muted hover:text-text-primary flex items-center gap-0.5 cursor-pointer"
          title="Reset session counters only (does not reset provider TPM)"
        >
          <RefreshCw className="w-2.5 h-2.5" />
          Reset session
        </button>
      </div>

      <p className="text-[10px] text-text-muted leading-snug">
        Pool <span className="text-text-primary font-semibold">{poolCount || 1}</span> key{poolCount === 1 ? '' : 's'}
        {summary.keyCount > 0 ? ` · ${summary.ready} ready · ${summary.cooling} cooling` : ' · usage appears after the first request'}
        {poolCount > 1 ? ' · exhausted keys rotate automatically' : ''}
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        <Stat label="Tokens used (window)" value={usedTokens != null ? fmt(usedTokens) : '—'} hint={summary.limitTokens != null ? `of ${fmt(summary.limitTokens)} TPM` : 'from last API header'} />
        <Stat label="Remaining" value={fmt(summary.remainingTokens)} hint={summary.nextResetAt ? `resets ${formatReset(summary.nextResetAt)}` : 'wait for a call'} />
        <Stat label="Requests left" value={fmt(summary.remainingRequests)} hint={summary.limitRequests != null ? `of ${fmt(summary.limitRequests)} RPM` : undefined} />
        <Stat label="Session tokens" value={fmt(summary.sessionTotalTokens)} hint={`${fmt(summary.sessionPromptTokens)} in / ${fmt(summary.sessionCompletionTokens)} out`} />
      </div>

      {(rows.length > 0 || placeholders.length > 0) && (
        <div className="space-y-1 max-h-28 overflow-y-auto pr-0.5">
          {rows.map((r) => (
            <div key={r.fingerprint} className="flex items-center justify-between gap-2 text-[9px] font-mono text-text-muted">
              <span className="text-text-secondary">{r.fingerprint}</span>
              <span>
                {r.coolingUntil > Date.now()
                  ? `cooling ${formatReset(r.coolingUntil)}`
                  : r.remainingTokens != null
                    ? `${fmt(r.remainingTokens)} tok left`
                    : r.lastStatus === 'ok'
                      ? 'ready'
                      : r.lastStatus || 'idle'}
              </span>
            </div>
          ))}
          {placeholders.map((fp) => (
            <div key={fp} className="flex items-center justify-between text-[9px] font-mono text-text-muted">
              <span>{fp}</span>
              <span>not used yet</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-card border border-card-border/60 px-2 py-1.5">
      <p className="text-[8px] uppercase tracking-wider text-text-muted font-bold">{label}</p>
      <p className="text-[11px] font-semibold text-text-primary tabular-nums">{value}</p>
      {hint && <p className="text-[8px] text-text-muted leading-tight mt-0.5">{hint}</p>}
    </div>
  );
}
