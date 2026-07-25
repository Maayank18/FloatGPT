import { searchKnowledge } from '../../knowledge/search-index';
import { KnowledgeChunk, KnowledgeSource, AppState } from '../../types';

export interface RetrievalResult {
  chunk: KnowledgeChunk;
  sourceName: string;
}

/**
 * Searches the knowledge base and returns top K relevant chunks formatted for the LLM.
 */
export function retrieveContext(query: string, state: AppState, limit: number = 3): string {
  const chunks = searchKnowledge(query, limit);
  if (chunks.length === 0) return '';

  const knowledgeSources = state.knowledge || [];

  let formattedContext = '--- RETRIEVED KNOWLEDGE SOURCES ---\n';
  
  chunks.forEach((chunk, i) => {
    const source = knowledgeSources.find((s: KnowledgeSource) => s.id === chunk.sourceId);
    const sourceName = source ? source.filename : 'Unknown Source';
    const pageInfo = chunk.pageNumber ? ` (Page ${chunk.pageNumber})` : '';

    formattedContext += `\n[Source ${i + 1}: ${sourceName}${pageInfo}]\n${chunk.text}\n`;
  });

  formattedContext += '\n--- END RETRIEVED SOURCES ---\n';
  return formattedContext;
}

export function getAllImageContexts(state: AppState): { mimeType: string, data: string }[] {
  const knowledgeSources = state.knowledge || [];
  
  // Get recently uploaded images
  return knowledgeSources
    .filter((s: KnowledgeSource) => s.type === 'image' && s.status === 'ready')
    .slice(0, 3) // limit to recent 3 for token safety
    .map((s: KnowledgeSource) => ({
      mimeType: s.mimeType,
      data: s.content // base64 URL
    }));
}
