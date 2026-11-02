/** Speak only when the person asked for the answer to be said aloud. */
export function wantsSpokenAnswer(text: string): boolean {
  const raw = String(text || '')
    .toLowerCase()
    .replace(/[’]/g, "'");
  if (/\b(don't|do not|never|stop|mat|nahi|nahin)\b[\s\S]{0,40}\b(speak|say|read|dictate|bolo|bol)\b/.test(raw)) {
    return false;
  }
  return (
    /\b(speak|dictate)\s+(the\s+)?(answer|reply|response)\b/.test(raw)
    || /\b(speak|say|read|dictate)\s+(it|this|that)\s+out(?:\s+loud)?\b/.test(raw)
    || /\b(say it out loud|read it aloud|read it out loud|speak it|dictate it)\b/.test(raw)
    || /\bread(?:\s+the)?\s+(answer|reply)(?:\s+aloud|\s+out loud)?\b/.test(raw)
    || /\b(bolo|bol do|suna do|sunao)\b/.test(raw)
  );
}

/**
 * A fuller reply, still in bullets: an explicit ask, a how/why/compare,
 * or code they want written.
 */
export function wantsLongAnswer(text: string): boolean {
  return /\b(in detail|detailed|elaborate|in depth|step by step|essay|long explanation|full explanation|explain fully|explain|how|why|compare|comparison|difference|versus|\bvs\b|walk me through|break down|breakdown|write the code|full code|complete code|implement|paragraphs?|leetcode|class\s+solution)\b/i.test(text);
}

/** Short factual replies stay small so the answer returns quickly. */
export function chatReplyBudget(text: string): { maxTokens: number; temperature: number } {
  if (wantsLongAnswer(text)) return { maxTokens: 1200, temperature: 0.4 };
  return { maxTokens: 280, temperature: 0.3 };
}
