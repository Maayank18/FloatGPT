import { resolveAlias } from '../agent/aliasResolver';

/**
 * One cleanup pass for every local task (screen, RAM, open app, files).
 * Polite English and Hinglish collapse to the same words the detectors already understand.
 * Chat that is not a task is left intact enough that it does not match those detectors.
 */

const TYPOS: [RegExp, string][] = [
  [/\bopn\b/g, 'open'],
  [/\bsettigns\b|\bsetings\b|\bsttings\b|\bsettingss\b/g, 'settings'],
  [/\bcalulator\b|\bcalculater\b/g, 'calculator'],
  [/\bnotpad\b|\bnote pad\b/g, 'notepad'],
  [/\bmemroy\b|\bmemmory\b/g, 'memory'],
  [/\bbatery\b|\bbattry\b/g, 'battery'],
  [/\bprocesor\b|\bproccessor\b/g, 'processor'],
  [/\bwatsapp\b|\bwhatsap\b|\bwhatapp\b|\bwatsap\b/g, 'whatsapp'],
  [/\byoutub\b|\byou tube\b/g, 'youtube'],
  [/\bdeskop\b|\bdeskto\b/g, 'desktop'],
  [/\btotla\b/g, 'total'],
  [/\bwhihc\b|\bwich\b/g, 'which'],
];

const LEADING =
  /^(?:(?:hey|hi|hello|yo|flow|flo|float)\s+)?(?:i (?:want|need)(?: you)? to|can you|could you|would you|will you|please|kindly|just|tell me|let me know|show me|i(?:'| a)?m trying to|help me)\s+/i;

export function normalizeUtterance(raw: string): string {
  let text = resolveAlias(String(raw || ''))
    .replace(/```[\s\S]*?```/g, ' ')
    .toLowerCase()
    .replace(/\b(what's|whats)\b/g, 'what is')
    .replace(/\b(i'm|im)\b/g, 'i am')
    .replace(/\b(don't|dont)\b/g, 'do not')
    .replace(/\b(can't|cant)\b/g, 'cannot')
    .replace(/[?!.,'"]+/g, ' ');

  for (const [pattern, replacement] of TYPOS) {
    text = text.replace(pattern, replacement);
  }

  for (let i = 0; i < 3; i++) text = text.replace(LEADING, ' ');

  text = text
    .replace(/\b(aap|tum|pls|plz|yaar|bhai|bro|merko|mujhe|mujko|mujhko|sakte|sakti|sakta|kya|zaroor|zara|bas|bata|batao|bataiye|bataye|abhi|toh|ho|hain|hai|raha|rahi|rahe|please|kindly|just)\b/g, ' ')
    .replace(/\bfor me\b/g, ' ')
    .replace(/\bright now\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}
