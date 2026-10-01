import {
  isRateLimitError,
  isModelUnavailableError,
  parseRetryAfterMs,
  parseDurationMs
} from './rateLimit';
import { orderKeysForAttempt, noteRateLimit, keyFingerprint, shortestCooldownMs } from './keyHealth';

function assert(cond: boolean, name: string) {
  if (!cond) throw new Error(name);
  console.log('  PASS', name);
}

{
  console.log('Rate-limit classification');
  const groq429 =
    'Rate limit reached for model llama-3.3-70b-versatile in organization org_x. Limit 100000 TPM, used 100000. Please try again in 7m12s. [HTTP_429 rate_limit_exceeded]';
  assert(isRateLimitError(groq429) === true, 'Groq TPM message is a rate limit');
  assert(isModelUnavailableError(groq429) === false, 'Groq TPM is NOT model unavailable');
  assert(isRateLimitError('HTTP_429 rate_limit_exceeded too many requests') === true, 'HTTP_429 classified');
  assert(isModelUnavailableError('The model `foo` does not exist') === true, 'True missing model');
  assert(isModelUnavailableError('model_not_found') === true, 'model_not_found');

  const wait = parseRetryAfterMs(groq429);
  assert(wait >= 7 * 60 * 1000 && wait < 8 * 60 * 1000, `parses 7m12s (got ${wait})`);
  assert(parseDurationMs('2s') === 2000, '2s duration');
  assert(parseRetryAfterMs('', '3') === 3000, 'Retry-After seconds');

  const k1 = 'gsk_aaaaaaaaaaaaaaaaaaaaaaa1111';
  const k2 = 'gsk_bbbbbbbbbbbbbbbbbbbbbbb2222';
  const k3 = 'gsk_ccccccccccccccccccccccc3333';
  noteRateLimit('groq', k1, groq429, 'llama-3.3-70b-versatile');
  const ordered = orderKeysForAttempt('groq', [k1, k2, k3]);
  assert(ordered[0] !== k1, 'Cooling key is not tried first');
  assert(ordered.includes(k2) && ordered.includes(k3), 'Ready keys stay in the pool');
  assert(shortestCooldownMs('groq', [k1]) > 1000, 'Cooldown recorded for limited key');
  assert(keyFingerprint(k1).endsWith('1111'), 'Fingerprint uses last 4');
  console.log('ok');
}
