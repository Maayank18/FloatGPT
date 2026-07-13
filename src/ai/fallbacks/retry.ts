/**
 * Fallback & Retry Logic
 * Handles provider failover and retry on transient errors.
 * Ensures one provider failure does not break the entire AI experience.
 */

import type { AIProvider, GenerationArgs } from '../providers/types';
import { AILogger } from '../observability/logger';

/** HTTP status codes that indicate a transient/retryable error */
const TRANSIENT_ERROR_PATTERNS = [
  'rate limit', '429', '500', '502', '503', '504',
  'timeout', 'ECONNRESET', 'ENOTFOUND', 'network',
  'fetch failed'
];

function isTransientError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return TRANSIENT_ERROR_PATTERNS.some(pattern => lower.includes(pattern));
}

function isPermanentError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return lower.includes('401') || lower.includes('403') || 
         lower.includes('invalid api key') || lower.includes('authentication') ||
         lower.includes('unsupported model');
}

/**
 * Executes an AI generation request with retry and optional provider fallback.
 * 
 * Strategy:
 * 1. Try the primary provider up to maxRetries times on transient errors.
 * 2. On permanent failure (auth, unsupported model), skip immediately.
 * 3. If primary exhausts retries, try fallback providers in order.
 * 4. If ALL providers fail, return a graceful degraded response.
 */
export async function executeWithFallback(
  primaryProvider: AIProvider,
  fallbackProviders: AIProvider[],
  args: GenerationArgs,
  maxRetries: number = 2
): Promise<any> {
  const allProviders = [primaryProvider, ...fallbackProviders];
  
  for (const provider of allProviders) {
    const keysToTry = [args.apiKey];
    if (args.fallbackApiKeys && args.fallbackApiKeys.length > 0) {
      keysToTry.push(...args.fallbackApiKeys.filter(k => k && k.trim() !== ''));
    }

    for (let keyIdx = 0; keyIdx < keysToTry.length; keyIdx++) {
      const currentKey = keysToTry[keyIdx];
      let retriesLeft = provider === primaryProvider && keyIdx === 0 ? maxRetries : 1;
      let keyFailed = false;

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
            args.useWebSearch
          );
          return result;
        } catch (error: any) {
          const errorMsg = error.message || 'Unknown error';
          
          if (isPermanentError(errorMsg)) {
            AILogger.logFailure(provider.id, `Key ${keyIdx + 1} failed: ${errorMsg}`, false);
            keyFailed = true;
            break; // Skip to next key immediately
          }
          
          if (isTransientError(errorMsg) && retriesLeft > 0) {
            AILogger.logFailure(provider.id, `Key ${keyIdx + 1} transient error: ${errorMsg}`, true);
            retriesLeft--;
            await new Promise(resolve => setTimeout(resolve, 1000 * (maxRetries - retriesLeft)));
            continue;
          }
          
          AILogger.logFailure(provider.id, `Key ${keyIdx + 1} failed: ${errorMsg}`, false);
          keyFailed = true;
          break; // Non-retryable for this key, move to next key
        }
      }
      
      if (!keyFailed) {
         // If we exited the while loop without breaking, it means retries were exhausted
         // but it wasn't explicitly marked as failed, though it practically is.
      }
    }
    
    // If we're about to try a fallback provider, log it
    const nextIdx = allProviders.indexOf(provider) + 1;
    if (nextIdx < allProviders.length) {
      AILogger.logFallback(provider.id, allProviders[nextIdx].id, 'Provider and all fallback keys failed');
    }
  }
  
  // All providers exhausted — return graceful degraded response
  return {
    message: "All AI providers are currently unavailable. Please check your API keys and try again in a moment."
  };
}
