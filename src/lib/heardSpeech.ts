/**
 * Pick the sentence the user actually said.
 * Whisper is preferred when it heard a real sentence.
 * A short "Float" hallucination must not replace a full question.
 */

const WAKE = /^(?:hey\s+|hi\s+|ok\s+)?(?:floatgpt|float|flow)\b[,:\s]*/i;

const PROMPT_ECHOES = [
  'hey float',
  'hey flow',
  'zoom in',
  'scroll down',
  'switch tab',
  'pause video',
  'take screenshot',
  'open vs code'
];

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function stripWake(text: string): string {
  return String(text || '').replace(WAKE, '').trim();
}

function isPromptEcho(text: string): boolean {
  const lower = text.toLowerCase();
  const hits = PROMPT_ECHOES.filter((phrase) => lower.includes(phrase)).length;
  return hits >= 2;
}

function isWakeOnly(text: string): boolean {
  const bare = String(text || '').trim().toLowerCase().replace(/[?.!,]+$/g, '');
  return /^(?:hey\s+|hi\s+|ok\s+)?(?:floatgpt|float|flow)$/.test(bare);
}

/** Empty string means nothing usable was heard. */
export function chooseHeardSpeech(browserText: string, whisperText: string): string {
  const browser = stripWake(browserText);
  const whisper = stripWake(whisperText);

  if (isWakeOnly(browserText) && !whisper) return '';
  if (isWakeOnly(whisperText) && !browser) return '';
  if (isPromptEcho(whisper) && browser) return browser;
  if (!whisper) return isWakeOnly(browserText) ? '' : browser;
  if (!browser) return isWakeOnly(whisperText) ? '' : whisper;
  if (words(whisper).length <= 3 && words(browser).length >= 5) return browser;
  if (words(browser).length >= words(whisper).length + 4) return browser;
  return whisper;
}
