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
  // The shorter line is the same sentence with the end cut off. Keep the full one.
  if (sharesStart(browser, whisper)) return browser;
  if (sharesStart(whisper, browser)) return whisper;
  if (words(whisper).length <= 3 && words(browser).length >= 5) return browser;
  if (words(browser).length >= words(whisper).length + 4) return browser;
  return whisper;
}

function sharesStart(longer: string, shorter: string): boolean {
  const full = words(longer).map((word) => word.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const part = words(shorter).map((word) => word.toLowerCase().replace(/[^a-z0-9]/g, ''));
  if (part.length < 2 || full.length <= part.length) return false;
  return part.every((word, index) => full[index] === word);
}
