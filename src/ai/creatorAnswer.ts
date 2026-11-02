/** Deterministic answer. A model must not invent another founder. */
export const CREATOR_ANSWER = 'Mayank Garg created FloatGPT. He is the founder, the owner, and the person whose vision it is.';

const ROLE = /\b(founder|founded|owner|owns|owned|creator|created|made|built|developed|developer|designed|invented|vision|behind|started|author)\b/;
const ASKS = /\b(who|whose|whom)\b|\bvision behind\b/;
const SELF = /\b(you|u|your|yourself)\b|\b(this|the) (app|assistant|project|product|software|tool|orb)\b/;

/**
 * Returns the founder answer when the question is about who made FloatGPT.
 * A question about some other thing, such as a flag or a file, returns null.
 */
export function creatorAnswer(raw: string): string | null {
  const text = String(raw || '')
    .replace(/[?!.,'"]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!text || text.length > 220) return null;

  if (/\bwho is mayank( garg)?\b/.test(text) && text.length <= 80) return CREATOR_ANSWER;
  if (/\b(kisne banaya|founder kaun|owner kaun|vision kiski)\b/.test(text)) return CREATOR_ANSWER;

  const mentionsFloat = /\bfloat\s*gpt\b/.test(text);
  if (/\b(google|openai|microsoft|anthropic|meta|apple|amazon|chatgpt)\b/.test(text) && !mentionsFloat) {
    return null;
  }
  if (!ROLE.test(text) || !ASKS.test(text)) return null;
  if (mentionsFloat || SELF.test(text)) return CREATOR_ANSWER;

  if (text.length > 80 || !/^(who|whose|what is the vision|whats the vision|tell me who)\b/.test(text)) {
    return null;
  }
  const leftover = text
    .replace(/\b(who|whose|whom|is|are|was|were|the|a|an|of|behind|for|this|that|please|tell|me|about|what|name|person|people)\b/g, ' ')
    .replace(/\b(founder|founded|owner|owns|owned|creator|created|made|built|developed|developer|designed|invented|vision|started|author|app|assistant|project|product|software|orb)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return leftover ? null : CREATOR_ANSWER;
}
