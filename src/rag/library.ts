import { useAppStore } from '../state/store';
import { removeSourceFromIndex } from '../knowledge/search-index';

/**
 * The on-device document library.
 * A file stays here after upload so later questions can search it.
 * Removing a file records its id so a saved copy cannot come back.
 */
export const DocumentLibrary = {
  remove(sourceId: string): void {
    const store = useAppStore.getState();
    removeSourceFromIndex(sourceId);
    store.setState((prev) => ({
      ...prev,
      knowledge: (prev.knowledge || []).filter((k) => k.id !== sourceId),
      dismissedKnowledgeIds: Array.from(new Set([...(prev.dismissedKnowledgeIds || []), sourceId])),
    }));
  },

  clear(): void {
    const store = useAppStore.getState();
    store.setState((prev) => {
      const ids = (prev.knowledge || []).map((k) => k.id);
      ids.forEach(removeSourceFromIndex);
      return {
        ...prev,
        knowledge: [],
        dismissedKnowledgeIds: Array.from(new Set([...(prev.dismissedKnowledgeIds || []), ...ids])),
      };
    });
  },
};
