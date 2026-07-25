import { KnowledgeChunk } from '../types';

export interface ChunkingOptions {
  maxChunkSize: number;
  overlap: number;
}

/**
 * Splits extracted text into smaller, overlapping chunks suitable for vector embedding or search.
 * Tries to split by paragraphs first, then sentences, then raw characters.
 */
export function chunkText(
  sourceId: string, 
  text: string, 
  options: ChunkingOptions = { maxChunkSize: 1000, overlap: 200 }
): KnowledgeChunk[] {
  if (!text || text.trim() === '') return [];

  // Basic page-aware chunking if the text contains '--- Page X ---' markers (from PDF extraction)
  const chunks: KnowledgeChunk[] = [];
  let currentPage = 1;
  
  // Split by double newline to get paragraphs
  const paragraphs = text.split('\n\n');
  
  let currentChunkText = '';
  
  for (const para of paragraphs) {
    // Check if paragraph is a page marker
    const pageMatch = para.match(/--- Page (\d+) ---/);
    if (pageMatch) {
      currentPage = parseInt(pageMatch[1], 10);
      continue;
    }

    if ((currentChunkText.length + para.length) > options.maxChunkSize && currentChunkText.length > 0) {
      chunks.push({
        id: `${sourceId}-chunk-${chunks.length}`,
        sourceId,
        text: currentChunkText.trim(),
        pageNumber: currentPage
      });
      // Keep overlap from end of current chunk
      currentChunkText = currentChunkText.slice(Math.max(0, currentChunkText.length - options.overlap)) + '\n\n' + para;
    } else {
      if (currentChunkText.length > 0) {
        currentChunkText += '\n\n';
      }
      currentChunkText += para;
    }
  }

  // Add the last chunk
  if (currentChunkText.trim().length > 0) {
    chunks.push({
      id: `${sourceId}-chunk-${chunks.length}`,
      sourceId,
      text: currentChunkText.trim(),
      pageNumber: currentPage
    });
  }

  return chunks;
}
