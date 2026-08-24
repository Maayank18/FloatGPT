import { searchKnowledge, syncIndexWithSources } from '../../knowledge/search-index';
import { KnowledgeChunk, KnowledgeSource, AppState } from '../../types';

export interface RetrievalResult {
  chunk: KnowledgeChunk;
  sourceName: string;
}

/**
 * Searches the knowledge base and returns top K relevant chunks formatted for the LLM.
 * Optimized for minimal token footprint with maximum relevance.
 */
export function retrieveContext(query: string, state: AppState, limit: number = 3): string {
  const knowledgeSources = (state.knowledge || []).filter((s: KnowledgeSource) => s.status === 'ready');
  if (knowledgeSources.length === 0) return '';

  // Synchronize search index with active session knowledge sources
  syncIndexWithSources(knowledgeSources);

  // 1. Try keyword and semantic search
  let chunks = searchKnowledge(query, limit);

  // 2. If no exact keyword match, fallback to salient introductory chunks
  if (chunks.length === 0) {
    const fallbackChunks: KnowledgeChunk[] = [];
    for (const src of knowledgeSources) {
      if (src.chunks && src.chunks.length > 0) {
        fallbackChunks.push(...src.chunks.slice(0, limit));
      } else if (src.type === 'image') {
        fallbackChunks.push({
          id: `${src.id}-img-chunk`,
          sourceId: src.id,
          text: `[Attached Image File: ${src.filename} (${src.mimeType || 'image'}, ${(src.sizeBytes ? (src.sizeBytes / 1024).toFixed(1) : '0')} KB)]`
        });
      } else if (src.content) {
        fallbackChunks.push({
          id: `${src.id}-chunk-0`,
          sourceId: src.id,
          text: src.content.slice(0, 500)
        });
      }
      if (fallbackChunks.length >= limit) break;
    }
    chunks = fallbackChunks.slice(0, limit);
  }

  if (chunks.length === 0) return '';

  let formattedContext = '--- RELEVANT KNOWLEDGE EXCERPTS (RAG) ---\n';
  
  chunks.forEach((chunk, i) => {
    const source = knowledgeSources.find((s: KnowledgeSource) => s.id === chunk.sourceId);
    const sourceName = source ? source.filename : 'Uploaded Document';
    const pageInfo = chunk.pageNumber ? ` (Page ${chunk.pageNumber})` : '';

    // Token-optimized excerpt truncation (max 600 chars per chunk to protect Groq TPM limit)
    let textSnippet = chunk.text;
    if (source?.type === 'image' || textSnippet.startsWith('data:image/')) {
      textSnippet = `[Attached Image: ${sourceName}]`;
    } else if (textSnippet.length > 600) {
      textSnippet = textSnippet.slice(0, 600) + '...';
    }

    formattedContext += `\n[Excerpt ${i + 1} | File: ${sourceName}${pageInfo}]\n${textSnippet}\n`;
  });

  formattedContext += '\n--- END RELEVANT KNOWLEDGE ---\n';
  return formattedContext;
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
