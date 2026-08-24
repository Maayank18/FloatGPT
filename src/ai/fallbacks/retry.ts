/**
 * Fallback & Retry Logic
 * Handles provider failover and retry on transient errors.
 * Ensures one provider failure does not break the entire AI experience.
 */

import type { AIProvider, GenerationArgs } from '../providers/types';
import { AILogger } from '../observability/logger';

/** HTTP status codes that indicate a transient/retryable error */
const TRANSIENT_ERROR_PATTERNS = [
  '500', '502', '503', '504',
  'timeout', 'ECONNRESET', 'ENOTFOUND', 'network',
  'fetch failed'
];

function isRateLimitError(errorMessage: string): boolean {
  const lower = (errorMessage || '').toLowerCase();
  return lower.includes('rate limit') || 
         lower.includes('429') || 
         lower.includes('tokens per minute') || 
         lower.includes('tpm') || 
         lower.includes('requests per minute') || 
         lower.includes('rpm') || 
         lower.includes('quota') ||
         lower.includes('resource_exhausted');
}

function isTransientError(errorMessage: string): boolean {
  const lower = (errorMessage || '').toLowerCase();
  return TRANSIENT_ERROR_PATTERNS.some(pattern => lower.includes(pattern));
}

function isPermanentError(errorMessage: string): boolean {
  const lower = (errorMessage || '').toLowerCase();
  return lower.includes('401') || lower.includes('403') || 
         lower.includes('invalid api key') || lower.includes('authentication') ||
         lower.includes('unsupported model');
}

/**
 * Executes an AI generation request with retry and seamless multi-key pool failover.
 * 
 * Strategy:
 * 1. If a key hits a rate limit (429/TPM/RPM), INSTANTLY rotate to the next key in the pool.
 * 2. On permanent failure (auth/invalid key), skip to the next key immediately.
 * 3. On transient network glitches (500/503), retry up to maxRetries times.
 * 4. Try all keys across all fallback providers before failing.
 */
export async function executeWithFallback(
  primaryProvider: AIProvider,
  fallbackProviders: AIProvider[],
  args: GenerationArgs,
  maxRetries: number = 2
): Promise<any> {
  const allProviders = [primaryProvider, ...fallbackProviders];
  
  let lastRecordedError = '';

  for (const provider of allProviders) {
    const keysToTry: string[] = [];
    if (args.apiKey && args.apiKey.trim() !== '') {
      keysToTry.push(args.apiKey.trim());
    }
    if (args.fallbackApiKeys && args.fallbackApiKeys.length > 0) {
      for (const k of args.fallbackApiKeys) {
        if (k && typeof k === 'string' && k.trim() !== '' && !keysToTry.includes(k.trim())) {
          keysToTry.push(k.trim());
        }
      }
    }

    // If no keys configured for this provider, skip
    if (keysToTry.length === 0) continue;

    for (let keyIdx = 0; keyIdx < keysToTry.length; keyIdx++) {
      const currentKey = keysToTry[keyIdx];
      let retriesLeft = maxRetries;

      while (retriesLeft >= 0) {
        try {
          const result = await provider.generate(
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
          return result;
        } catch (error: any) {
          const errorMsg = error.message || 'Unknown error';
          lastRecordedError = errorMsg;
          
          // 1. Invalid API Key / Auth Failure -> Skip immediately to next key
          if (isPermanentError(errorMsg)) {
            AILogger.logFailure(provider.id, `Key ${keyIdx + 1}/${keysToTry.length} authentication error: ${errorMsg}`, false);
            break;
          }
          
          // 2. Rate Limit (429 / Quota / TPM) -> INSTANT FAILOVER to next key without delaying
          if (isRateLimitError(errorMsg)) {
            const hasNextKey = keyIdx + 1 < keysToTry.length;
            console.warn(`[FloatGPT:KeyRotation] Key ${keyIdx + 1}/${keysToTry.length} hit rate limit (${errorMsg}). ${hasNextKey ? `Failing over to Key ${keyIdx + 2}...` : 'All keys in pool exhausted.'}`);
            AILogger.logFailure(provider.id, `Key ${keyIdx + 1}/${keysToTry.length} rate limited -> Failover`, false);
            break; // Break retry loop to immediately advance to next key in pool
          }

          // 3. Transient Network / Server Error -> Retry with backoff
          if (isTransientError(errorMsg) && retriesLeft > 0) {
            AILogger.logFailure(provider.id, `Key ${keyIdx + 1}/${keysToTry.length} transient error (${errorMsg}) -> Retrying (${retriesLeft} left)`, true);
            retriesLeft--;
            await new Promise(resolve => setTimeout(resolve, 800 * (maxRetries - retriesLeft + 1)));
            continue;
          }
          
          // Generic failure -> Skip to next key
          AILogger.logFailure(provider.id, `Key ${keyIdx + 1}/${keysToTry.length} failed: ${errorMsg}`, false);
          break;
        }
      }
    }
    
    // If we're about to try a fallback provider, log it
    const nextIdx = allProviders.indexOf(provider) + 1;
    if (nextIdx < allProviders.length) {
      AILogger.logFallback(provider.id, allProviders[nextIdx].id, 'Provider and all fallback keys failed');
    }
  }
  
  // All providers exhausted — return helpful and descriptive diagnostic response
  const lastError = lastRecordedError.toLowerCase();
  
  if (lastError.includes('invalid api key') || lastError.includes('401') || lastError.includes('authentication')) {
    return {
      message: `⚠️ **AI Authentication Error (${primaryProvider.name})**\n\nYour API key was rejected as invalid or expired.\n\n* **Action required:** Please check or update your API key in **Settings (Gear Icon)** or configure a new key at [Groq Console](https://console.groq.com/keys).`
    };
  }

  if (lastError.includes('rate limit') || lastError.includes('429') || lastError.includes('quota')) {
    return {
      message: `⚠️ **AI Rate Limit Exceeded (${primaryProvider.name})**\n\nYour API request exceeded the rate limit or token quota.\n\n* **Action required:** Please wait a moment before trying again, or check your rate limits on the provider dashboard.`
    };
  }

  if (lastError.includes('model') || lastError.includes('404') || lastError.includes('not found') || lastError.includes('unsupported')) {
    return {
      message: `⚠️ **AI Model Unavailable (${primaryProvider.name})**\n\nThe selected model \`${args.model}\` is currently unavailable or not recognized.\n\n* **Action required:** Please choose an active model (such as **GPT OSS 120B**, **GPT OSS 20B**, or **Llama 3.3 70B**) in **Settings**.`
    };
  }

  return {
    message: `⚠️ **AI Service Error (${primaryProvider.name})**\n\n${lastRecordedError || "All AI providers are currently unavailable."}\n\n* Please verify your internet connection and API key configuration in Settings.`
  };
}
