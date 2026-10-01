/**
 * FloatGPT — Messenger Agent: Conservative Retry Policy Manager
 * 
 * Manages transient failure detection and exponential backoff with jitter.
 * Strictly prevents duplicate sends and refuses blind retries on unknown states.
 */

import { RetryPolicy } from '../types/messenger.types';

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  backoffFactor: 2.5,
  initialDelayMs: 5000,
  maxDelayMs: 60000
};

export class MessageRetryManager {
  /**
   * Determines whether an error is transient and safe to retry.
   */
  static isRetryableError(errorMessage?: string, statusCode?: number): boolean {
    if (!errorMessage && !statusCode) return false;

    const err = (errorMessage || '').toLowerCase();

    // 1. Hard Non-Retryable Failures
    if (
      err.includes('invalid recipient') ||
      err.includes('not a registered') ||
      err.includes('auth_required') ||
      err.includes('unauthenticated') ||
      err.includes('unauthorized') ||
      err.includes('permission denied') ||
      err.includes('forbidden') ||
      err.includes('exceeds character limit') ||
      err.includes('delivery status unknown') // NEVER blindly retry an unknown send
    ) {
      return false;
    }

    if (statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 404) {
      return false;
    }

    // 2. Transient Retryable Failures
    if (
      err.includes('timeout') ||
      err.includes('econnreset') ||
      err.includes('etimedout') ||
      err.includes('network error') ||
      err.includes('fetch failed') ||
      err.includes('rate limit') ||
      err.includes('too many requests') ||
      err.includes('service unavailable') ||
      err.includes('503') ||
      err.includes('502') ||
      err.includes('504')
    ) {
      return true;
    }

    if (statusCode === 429 || statusCode === 502 || statusCode === 503 || statusCode === 504) {
      return true;
    }

    return false;
  }

  /**
   * Computes the exponential backoff delay for the given attempt.
   */
  static getBackoffDelayMs(attemptCount: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): number {
    const exponent = Math.max(0, attemptCount - 1);
    const calculated = policy.initialDelayMs * Math.pow(policy.backoffFactor, exponent);
    const clamped = Math.min(calculated, policy.maxDelayMs);

    // Add +/- 15% random jitter to prevent thundering herds
    const jitter = (Math.random() * 0.3 - 0.15) * clamped;
    return Math.round(clamped + jitter);
  }
}
