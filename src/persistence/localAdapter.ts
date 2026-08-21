import { get, set, del } from 'idb-keyval';
import { AppState } from '../types';

const STORE_KEY = 'floatgpt_local_state';

export const LocalAdapter = {
  /**
   * Saves the entire AppState to IndexedDB.
   * This provides lightning-fast local persistence before syncing to Firebase.
   */
  async saveStateLocally(state: AppState): Promise<void> {
    try {
      await set(STORE_KEY, state);
    } catch (e) {
      console.error('[LocalSync] Failed to save state to IndexedDB:', e);
    }
  },

  /**
   * Retrieves the AppState from IndexedDB.
   * Useful for immediate zero-latency startup while waiting for Firebase.
   */
  async getStateLocally(): Promise<AppState | null> {
    try {
      const state = await get(STORE_KEY);
      return state || null;
    } catch (e) {
      console.error('[LocalSync] Failed to fetch state from IndexedDB:', e);
      return null;
    }
  },
  
  /**
   * Clears the local state (e.g. on logout)
   */
  async clearState(): Promise<void> {
    try {
      await del(STORE_KEY);
    } catch (e) {
      console.error('[LocalSync] Failed to clear local state:', e);
    }
  }
};
