import MiniSearch from 'minisearch';
import { KnowledgeChunk, KnowledgeSource } from '../types';

let miniSearch: MiniSearch<KnowledgeChunk> | null = null;
const indexedSourceIds = new Set<string>();

export function initSearchIndex(forceNew = false) {
  if (!miniSearch || forceNew) {
    miniSearch = new MiniSearch({
      fields: ['text'],
      storeFields: ['id', 'sourceId', 'text', 'pageNumber'],
      idField: 'id',
      searchOptions: {
        boost: { text: 2 },
        fuzzy: 0.2,
        prefix: true
      }
    });
    indexedSourceIds.clear();
  }
  return miniSearch;
}

export function indexSource(source: KnowledgeSource) {
  const index = initSearchIndex();
  if (source.chunks && source.chunks.length > 0 && !indexedSourceIds.has(source.id)) {
    index.addAll(source.chunks);
    indexedSourceIds.add(source.id);
  }
}

export function syncIndexWithSources(sources: KnowledgeSource[]) {
  const index = initSearchIndex(true);
  for (const source of sources) {
    if (source.status === 'ready' && source.chunks && source.chunks.length > 0) {
      index.addAll(source.chunks);
      indexedSourceIds.add(source.id);
    }
  }
}

export function searchKnowledge(query: string, limit: number = 3): KnowledgeChunk[] {
  const index = initSearchIndex();
  if (!query || query.trim() === '') return [];

  const cleanQuery = query.replace(/[^\w\s]/gi, ' ').trim();
  if (!cleanQuery) return [];

  try {
    const results = index.search(cleanQuery, { prefix: true, combineWith: 'OR' });
    
    return results.slice(0, limit).map(res => ({
      id: res.id,
      sourceId: res.sourceId,
      text: res.text,
      pageNumber: res.pageNumber,
      score: res.score
    }));
  } catch {
    return [];
  }
}

export function removeSourceFromIndex(sourceId: string) {
  indexedSourceIds.delete(sourceId);
}
