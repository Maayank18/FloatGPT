/**
 * Flow Agent — Alias Resolver
 * 
 * Normalizes misheard entity names from the speech-to-text pipeline.
 * Whisper often mishears "LinkedIn" as "Ling Ling", "Edge" as "Ed", etc.
 * 
 * Two-stage pipeline:
 *   1. Strip universal articles ("the") between verbs and entities.
 *   2. Replace known bad transcripts with their correct aliases.
 */

// ─── Known STT Mistakes ────────────────────────────────────────

const ALIAS_MAP: Record<string, string> = {
  // Websites — common Whisper hallucinations
  'ling ling': 'linkedin',
  'linden': 'linkedin',
  'linked in': 'linkedin',
  'link in': 'linkedin',
  'link din': 'linkedin',
  
  'you tube': 'youtube',
  'u tube': 'youtube',
  'y tube': 'youtube',
  
  'lee code': 'leetcode',
  'lead code': 'leetcode',
  'let code': 'leetcode',
  'leet code': 'leetcode',
  
  'git hub': 'github',
  'get hub': 'github',
  
  'stack overflow': 'stackoverflow',
  
  // Apps
  'ed': 'edge',
  'microsoft edge': 'edge',
  
  'google chrome': 'chrome',
  
  // FloatGPT Entities
  'float gpt': 'floatgpt',
  'float g p t': 'floatgpt',
};

const URDU_ARABIC_FALLBACKS: Record<string, string> = {
  'ہیلو ہاو اے یو کیسے ہو': 'Hello, how are you? Kaise ho?',
  'ہیلو': 'Hello',
  'ہاو اے یو': 'how are you',
  'کیسے ہو': 'kaise ho',
  'کیا حال ہے': 'kya haal hai',
  'ٹھیک ہے': 'theek hai',
  'شکریہ': 'shukriya',
  'واٹس ایپ': 'WhatsApp',
  'یوٹیوب': 'YouTube',
  'گوگل': 'Google',
};

// ─── Public API ─────────────────────────────────────────────────

/**
 * Clean up misheard STT text before it reaches the command router.
 */
export function resolveAlias(text: string): string {
  let normalized = text;
  
  // Stage 1: Strip articles between action verbs and entities
  // "open the linkedin" → "open linkedin"
  // "search the web for X" → "search web for X"
  normalized = normalized.replace(
    /\b(open|launch|start|run|search|find|show|hide|close)\s+the\s+/gi,
    '$1 '
  );
  
  // Stage 2: Replace known bad transcripts with correct names
  for (const [badAlias, goodAlias] of Object.entries(ALIAS_MAP)) {
    const regex = new RegExp(`\\b${badAlias}\\b`, 'gi');
    normalized = normalized.replace(regex, goodAlias);
  }

  // Stage 3: Replace any accidental Urdu/Arabic transliterations with English/Hindi
  for (const [arabicScript, romanText] of Object.entries(URDU_ARABIC_FALLBACKS)) {
    if (normalized.includes(arabicScript)) {
      normalized = normalized.replace(new RegExp(arabicScript, 'g'), romanText);
    }
  }
  
  return normalized;
}
