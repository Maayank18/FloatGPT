/**
 * Multi-key failover with cooldowns. Rate limits rotate instantly.
 * Model-not-found does not rotate (same model on every key).
 */

import type { AIProvider, GenerationArgs } from '../providers/types';
import { AILogger } from '../observability/logger';
import { isAuthError, isModelUnavailableError, isRateLimitError } from '../config/rateLimit';
import {
  noteAuthFailure,
  noteRateLimit,
  orderKeysForAttempt,
  shortestCooldownMs,
  formatReset,
  listKeyHealth
} from '../config/keyHealth';

const TRANSIENT_ERROR_PATTERNS = [
  '500', '502', '503', '504',
  'timeout', 'ECONNRESET', 'ENOTFOUND', 'network',
  'fetch failed'
];

function isTransientError(errorMessage: string): boolean {
  if (isRateLimitError(errorMessage)) return false;
  const lower = (errorMessage || '').toLowerCase();
  return TRANSIENT_ERROR_PATTERNS.some((pattern) => lower.includes(pattern));
}

export async function executeWithFallback(
  primaryProvider: AIProvider,
  fallbackProviders: AIProvider[],
  args: GenerationArgs,
  maxRetries: number = 2
): Promise<any> {
  const allProviders = [primaryProvider, ...fallbackProviders];

  let lastRecordedError = '';
  let keysAttempted = 0;
  let rateLimitedKeys = 0;
  const attemptedFingerprints: string[] = [];

  for (const provider of allProviders) {
    const rawKeys: string[] = [];
    if (args.apiKey && args.apiKey.trim() !== '') rawKeys.push(args.apiKey.trim());
    if (args.fallbackApiKeys) {
      for (const k of args.fallbackApiKeys) {
        if (k && k.trim() && !rawKeys.includes(k.trim())) rawKeys.push(k.trim());
      }
    }
    if (rawKeys.length === 0) continue;

    const keysToTry = orderKeysForAttempt(provider.id, rawKeys);
    const cooldown = shortestCooldownMs(provider.id, rawKeys);
    const allCooling = keysToTry.length > 0 && keysToTry.every((k) => shortestCooldownMs(provider.id, [k]) > 200);

    if (allCooling && cooldown > 2500) {
      lastRecordedError = `Rate limit on all ${rawKeys.length} ${provider.name} key(s). Next retry in ${formatReset(Date.now() + cooldown)}.`;
      rateLimitedKeys = rawKeys.length;
      continue;
    }

    if (allCooling && cooldown > 0 && cooldown <= 2500) {
      await new Promise((r) => setTimeout(r, cooldown + 50));
    }

    for (let keyIdx = 0; keyIdx < keysToTry.length; keyIdx++) {
      const currentKey = keysToTry[keyIdx];
      const stillCooling = shortestCooldownMs(provider.id, [currentKey]) > 200;
      if (stillCooling && keyIdx < keysToTry.length - 1) {
        continue;
      }

      keysAttempted++;
      attemptedFingerprints.push(currentKey.slice(-4));
      let retriesLeft = maxRetries;

      while (retriesLeft >= 0) {
        try {
          return await provider.generate(
            currentKey,
            args.model,
            args.systemInstruction,
            args.history,
            args.prompt,
            args.temperature,
            args.maxTokens,
            args.isPlanMode,
            args.attachments,
            args.useWebSearch,
            args.tools
          );
        } catch (error: any) {
          const errorMsg = error.message || 'Unknown error';
          lastRecordedError = errorMsg;

          if (isModelUnavailableError(errorMsg)) {
            if (provider.id === 'groq' && args.model !== 'openai/gpt-oss-120b') {
              console.warn(`[FloatGPT:ModelFallback] Groq model ${args.model} unavailable. Auto-switching to openai/gpt-oss-120b.`);
              args.model = 'openai/gpt-oss-120b';
              continue;
            }
            AILogger.logFailure(provider.id, `Model ${args.model} rejected (not a rate limit): ${errorMsg}`, false);
            return {
              message: `⚠️ **AI Model Unavailable (${provider.name})**\n\n\`${args.model}\` was rejected by the API. This is **not** a rate limit.\n\n> ${errorMsg}\n\n* Pick a live model in Settings.`
            };
          }

          if (isRateLimitError(errorMsg)) {
            rateLimitedKeys++;
            noteRateLimit(provider.id, currentKey, errorMsg, args.model);
            const hasNext = keyIdx + 1 < keysToTry.length;
            console.warn(
              `[FloatGPT:KeyRotation] ${provider.id} key ${keyIdx + 1}/${keysToTry.length} rate-limited. ${hasNext ? 'Trying next key.' : 'Pool exhausted for this pass.'}`
            );
            AILogger.logFailure(provider.id, 'A provider key was rate limited → failover', false);
            break;
          }

          if (isAuthError(errorMsg)) {
            noteAuthFailure(provider.id, currentKey, errorMsg);
            AILogger.logFailure(provider.id, 'A provider key was rejected', false);
            break;
          }

          if (isTransientError(errorMsg) && retriesLeft > 0) {
            AILogger.logFailure(provider.id, 'A provider key hit a temporary error → retry', true);
            retriesLeft--;
            await new Promise((r) => setTimeout(r, 600 * (maxRetries - retriesLeft + 1)));
            continue;
          }

          AILogger.logFailure(provider.id, `A provider key failed: ${errorMsg}`, false);
          break;
        }
      }
    }

    const nextIdx = allProviders.indexOf(provider) + 1;
    if (nextIdx < allProviders.length) {
      AILogger.logFallback(provider.id, allProviders[nextIdx].id, 'Provider key pool exhausted');
    }
  }

  if (isRateLimitError(lastRecordedError) || rateLimitedKeys > 0) {
    const health = listKeyHealth(primaryProvider.id);
    const next = health.map((h) => h.coolingUntil).filter((t) => t > Date.now()).sort((a, b) => a - b)[0];
    return {
      message:
        `⚠️ **Rate limit (${primaryProvider.name}) — the model \`${args.model}\` is fine**\n\n` +
        `${lastRecordedError}\n\n` +
        `* Tried **${keysAttempted}** key attempt(s) across your pool` +
        (attemptedFingerprints.length ? ` (…${attemptedFingerprints.join(', …')})` : '') +
        `. ${rateLimitedKeys} hit TPM/RPM.` +
        (next ? ` Next window: **${formatReset(next)}**.` : '') +
        `\n* This is **not** “model unavailable”. Wait, add more keys, or switch provider.`
    };
  }

  if (isAuthError(lastRecordedError)) {
    return {
      message: `⚠️ **AI Authentication Error (${primaryProvider.name})**\n\n${lastRecordedError}\n\n* Tried ${keysAttempted} key(s). Check Settings.`
    };
  }

  if (isModelUnavailableError(lastRecordedError)) {
    return {
      message: `⚠️ **AI Model Unavailable (${primaryProvider.name})**\n\n\`${args.model}\` was rejected.\n\n> ${lastRecordedError}`
    };
  }

  return {
    message: `⚠️ **AI Service Error (${primaryProvider.name})**\n\n${lastRecordedError || 'All AI providers are currently unavailable.'}\n\n* Keys tried: ${keysAttempted}.`
  };
}
