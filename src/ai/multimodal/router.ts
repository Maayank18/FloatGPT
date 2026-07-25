import { AppState } from '../../types';

/**
 * Determines if the query likely needs context from the knowledge base.
 */
export function requiresRetrieval(query: string, state: AppState): boolean {
  const hasKnowledge = state.knowledge && state.knowledge.length > 0;
  
  if (!hasKnowledge) return false;

  const lowerQuery = query.toLowerCase();
  
  // Triggers for multimodal
  const triggers = [
    'pdf', 'document', 'doc', 'file', 'image', 'screenshot', 'picture', 'photo',
    'uploaded', 'notes', 'meeting', 'transcript', 'action items', 'summary',
    'summarize', 'extract', 'explain this'
  ];

  // If the query has any multimodal trigger words, we retrieve.
  // In a real system, we'd use an LLM or keyword matcher. For now, simple keywords + always retrieving a bit if files exist.
  if (triggers.some(t => lowerQuery.includes(t))) return true;

  // By default, if they have active files, we might always want to search just in case.
  return true;
}
