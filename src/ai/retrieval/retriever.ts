import { KnowledgeSource, KnowledgeChunk, AppState } from '../../types';
import { documentContext } from '../../rag/retrieve';

export interface RetrievalResult {
  chunk: KnowledgeChunk;
  sourceName: string;
}

/**
 * Searches the knowledge base and returns top K relevant chunks formatted for the LLM.
 * Optimized for minimal token footprint with maximum relevance.
 */
export function retrieveContext(query: string, state: AppState, _limit: number = 3): string {
  return documentContext(query, state);
}

export function getAllImageContexts(state: AppState): { mimeType: string, data: string, name?: string }[] {
  const knowledgeSources = state.knowledge || [];
  
  // Get recently uploaded valid images
  return knowledgeSources
    .filter((s: KnowledgeSource) => s.type === 'image' && s.status === 'ready' && s.content && s.content.startsWith('data:image/'))
    .slice(0, 2) // limit to recent 2 for token safety
    .map((s: KnowledgeSource) => ({
      name: s.filename,
      mimeType: s.mimeType,
      data: s.content // base64 URL
    }));
}
