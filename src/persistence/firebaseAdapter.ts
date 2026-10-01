import { AppState } from '../types';
import { loadAccountProfile, saveAccountProfile } from '../lib/accountSession';

/**
 * Account data is stored in MongoDB.
 * Chat transcripts stay on this device and are removed before every save.
 */
export const FirebaseAdapter = {
  async saveState(_userId: string, state: AppState): Promise<void> {
    try {
      await saveAccountProfile(state as unknown as Record<string, unknown>);
    } catch (e) {
      console.error('[Account] Failed to save profile', e instanceof Error ? e.message : e);
    }
  },

  async getState(_userId: string): Promise<any | null> {
    try {
      const stored = await loadAccountProfile();
      return stored.profile;
    } catch (e) {
      console.error('[Account] Failed to load profile', e instanceof Error ? e.message : e);
      return null;
    }
  },

  async saveWorkspace(_userId: string, workspaceData: any): Promise<void> {
    try {
      const current = await loadAccountProfile();
      await saveAccountProfile((current.profile || {}) as Record<string, unknown>, workspaceData);
    } catch (e) {
      console.error('[Account] Failed to save workspace', e instanceof Error ? e.message : e);
    }
  },

  async getWorkspace(_userId: string): Promise<any | null> {
    try {
      const stored = await loadAccountProfile();
      return stored.workspace;
    } catch (e) {
      console.error('[Account] Failed to load workspace', e instanceof Error ? e.message : e);
      return null;
    }
  }
};
