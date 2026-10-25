import { get, set, del } from 'idb-keyval';
import { AppState } from '../types';

const STORE_KEY = 'floatgpt_local_state';
const BACKUP_KEY = 'floatgpt_state_backup';

type StateBackup = { savedAt: number; state: AppState };

export const LocalAdapter = {
  /**
   * Saves the entire AppState to IndexedDB.
   * This provides lightning-fast local persistence before syncing to Firebase.
   */
  async saveStateLocally(state: AppState): Promise<void> {
    try {
      await set(STORE_KEY, state);
      void this.maybeBackup(state);
    } catch (e) {
      console.error('[LocalSync] Failed to save state to IndexedDB:', e);
    }
  },

  /**
   * Writes a second copy when Auto Backup Frequency is set and the last copy is older than that many days.
   * A backup failure must not block the live save.
   */
  async maybeBackup(state: AppState): Promise<void> {
    try {
      const days = Number(state.settings?.privacy?.autoBackupDays || 0);
      if (!Number.isFinite(days) || days <= 0) return;
      const existing = await get<StateBackup>(BACKUP_KEY);
      const savedAt = existing?.savedAt || 0;
      if (savedAt && Date.now() - savedAt < days * 24 * 60 * 60 * 1000) return;
      await set(BACKUP_KEY, { savedAt: Date.now(), state });
    } catch (e) {
      console.warn('[LocalSync] Backup skipped:', e);
    }
  },

  async getBackupSavedAt(): Promise<number | null> {
    try {
      const existing = await get<StateBackup>(BACKUP_KEY);
      return existing?.savedAt || null;
    } catch {
      return null;
    }
  },

  async restoreBackup(): Promise<AppState | null> {
    try {
      const existing = await get<StateBackup>(BACKUP_KEY);
      return existing?.state || null;
    } catch {
      return null;
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
