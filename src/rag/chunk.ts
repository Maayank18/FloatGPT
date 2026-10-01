import { KnowledgeChunk } from '../types';

export interface ChunkingOptions {
  maxChunkSize: number;
  overlap: number;
}

const DEFAULTS: ChunkingOptions = { maxChunkSize: 900, overlap: 140 };

function pushChunk(chunks: KnowledgeChunk[], sourceId: string, text: string, pageNumber: number) {
  const clean = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (clean.length < 20) return;
  chunks.push({
    id: `${sourceId}-chunk-${chunks.length}`,
    sourceId,
    text: clean,
    pageNumber,
  });
}

/**
 * Page-aware chunks. Sentences stay together so a later question can hit
 * one section (experience, skills, a heading) instead of a random slice.
 */
export function chunkText(
  sourceId: string,
  text: string,
  options: ChunkingOptions = DEFAULTS
): KnowledgeChunk[] {
  if (!text || !text.trim()) return [];

  const chunks: KnowledgeChunk[] = [];
  const pages = text.split(/(?=--- Page \d+ ---)/g).map((part) => part.trim()).filter(Boolean);
  const blocks = pages.length > 0 ? pages : [text];

  for (const block of blocks) {
    const pageMatch = block.match(/--- Page (\d+) ---/);
    const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : 1;
    const body = block.replace(/--- Page \d+ ---/g, '').trim();
    if (!body) continue;

    const sentences = body.split(/(?<=[.!?:])\s+|\n+/).map((line) => line.trim()).filter(Boolean);
    let current = '';

    for (const sentence of sentences) {
      if (sentence.length > options.maxChunkSize) {
        if (current) {
          pushChunk(chunks, sourceId, current, pageNumber);
          current = '';
        }
        for (let i = 0; i < sentence.length; i += options.maxChunkSize - options.overlap) {
          pushChunk(chunks, sourceId, sentence.slice(i, i + options.maxChunkSize), pageNumber);
        }
        continue;
      }

      if ((current.length + sentence.length + 1) > options.maxChunkSize && current) {
        pushChunk(chunks, sourceId, current, pageNumber);
        const tail = current.slice(Math.max(0, current.length - options.overlap));
        current = `${tail} ${sentence}`.trim();
      } else {
        current = current ? `${current}\n${sentence}` : sentence;
      }
    }

    if (current) pushChunk(chunks, sourceId, current, pageNumber);
  }

  return chunks;
}
