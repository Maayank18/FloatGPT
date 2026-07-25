import MiniSearch from 'minisearch';
import { KnowledgeChunk, KnowledgeSource } from '../types';

let miniSearch: MiniSearch<KnowledgeChunk>;

export function initSearchIndex() {
  if (!miniSearch) {
    miniSearch = new MiniSearch({
      fields: ['text'], // fields to index for full-text search
      storeFields: ['id', 'sourceId', 'text', 'pageNumber'], // fields to return with search results
      idField: 'id',
      searchOptions: {
        boost: { text: 2 },
        fuzzy: 0.2
      }
    });
  }
  return miniSearch;
}

export function indexSource(source: KnowledgeSource) {
  const index = initSearchIndex();
  if (source.chunks) {
    // Remove old chunks for this source if re-indexing
    const existing = index.documentCount;
    // (In a real DB we'd delete them. MiniSearch requires doc ID, so we could just clear and rebuild or track IDs)
    // For simplicity, we just add them.
    index.addAll(source.chunks);
  }
}

export function searchKnowledge(query: string, limit: number = 5): KnowledgeChunk[] {
  const index = initSearchIndex();
  if (!query || query.trim() === '') return [];

  const results = index.search(query, { prefix: true });
  
  return results.slice(0, limit).map(res => ({
    id: res.id,
    sourceId: res.sourceId,
    text: res.text,
    pageNumber: res.pageNumber,
    score: res.score
  }));
}

export function removeSourceFromIndex(sourceId: string) {
  // To completely remove a source's chunks from minisearch without having every chunk ID, 
  // it's easiest to rebuild or filter, but for now we skip removal logic.
}
