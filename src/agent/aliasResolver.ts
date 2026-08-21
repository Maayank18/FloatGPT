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
  
  return normalized;
}
