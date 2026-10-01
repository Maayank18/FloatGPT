import { KnowledgeChunk, KnowledgeSource } from '../types';

const STOP = new Set(
  'a an the and or of to for in on at by my me you your our is are was were be been being what which who how when where why please tell about this that those these from with into it its as do does did can could would should just from file document pdf page'.split(' ')
);

export function queryTokens(query: string): string[] {
  const words = String(query || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP.has(word));
  return Array.from(new Set(words)).slice(0, 16);
}

export function isBroadQuestion(query: string, tokens: string[]): boolean {
  return tokens.length <= 1 || /\b(summar|overview|sum up|what is this|about this|this (pdf|file|document|resume)|who is|tell me about|describe)\b/i.test(query);
}

function spreadChunks(sources: KnowledgeSource[], limit: number): KnowledgeChunk[] {
  const all = sources.flatMap((source) => source.chunks || []);
  if (all.length <= limit) return all;
  const picked: KnowledgeChunk[] = [];
  const step = Math.max(1, Math.floor(all.length / limit));
  for (let i = 0; i < all.length && picked.length < limit; i += step) {
    picked.push(all[i]);
  }
  if (picked[picked.length - 1] !== all[all.length - 1] && picked.length < limit) {
    picked.push(all[all.length - 1]);
  }
  return picked.slice(0, limit);
}

/** Rank saved chunks against the question. Broad questions sample the whole file. */
export function rankChunks(
  query: string,
  sources: KnowledgeSource[],
  limit: number = 6,
  earlierContext: string = ''
): KnowledgeChunk[] {
  const ready = sources.filter((source) => source.status === 'ready' && source.chunks && source.chunks.length > 0);
  if (ready.length === 0) return [];

  const tokens = queryTokens(`${query}\n${earlierContext}`);
  const focus = new Set(queryTokens(query));
  if (isBroadQuestion(query, queryTokens(query))) {
    return spreadChunks(ready, limit);
  }

  const scored = ready.flatMap((source) => (source.chunks || []).map((chunk) => {
    const hay = `${source.filename}\n${chunk.text}`.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (!hay.includes(token)) continue;
      score += focus.has(token) ? 3 : 1;
      if (token.length > 6) score += 1;
    }
    return { chunk, score, page: chunk.pageNumber || 0 };
  })).filter((row) => row.score > 0);

  if (scored.length === 0) return spreadChunks(ready, Math.min(limit, 4));

  scored.sort((a, b) => b.score - a.score || a.page - b.page);

  const picked: KnowledgeChunk[] = [];
  const perPage = new Map<string, number>();
  for (const row of scored) {
    const key = `${row.chunk.sourceId}:${row.page}`;
    const used = perPage.get(key) || 0;
    if (used >= 2) continue;
    perPage.set(key, used + 1);
    picked.push(row.chunk);
    if (picked.length >= limit) break;
  }
  return picked;
}
