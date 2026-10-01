import { AppState, KnowledgeSource } from '../../types';

/**
 * Determines if the query semantically requires context from the knowledge base.
 * Avoids injecting document excerpts into generic conversations.
 */
export function requiresRetrieval(query: string, state: AppState): boolean {
  const readySources = (state.knowledge || []).filter((s: KnowledgeSource) => s.status === 'ready');
  if (readySources.length === 0) return false;

  const lowerQuery = query.toLowerCase();
  
  // Specific retrieval triggers
  const triggers = [
    'pdf', 'document', 'doc', 'file', 'image', 'screenshot', 'picture', 'photo',
    'uploaded', 'notes', 'meeting', 'transcript', 'action items', 'summary',
    'summarize', 'extract', 'explain this', 'from the file', 'in the document',
    'according to', 'find in', 'search for'
  ];

  if (triggers.some(t => lowerQuery.includes(t))) return true;

  // Check if the query mentions the filename of any uploaded source
  if (readySources.some(s => s.filename && lowerQuery.includes(s.filename.toLowerCase().replace(/\.[^/.]+$/, '')))) {
    return true;
  }

  return false;
}
