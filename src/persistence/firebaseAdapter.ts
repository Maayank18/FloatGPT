import { doc, setDoc, getDoc, db, auth } from '../lib/firebase';
import { AppState } from '../types';

export const FirebaseAdapter = {
  async saveState(userId: string, state: AppState): Promise<void> {
    if (!userId) return;
    try {
      // Create a shallow copy and delete transcripts so the global state sync doesn't wipe out surface transcripts
      const stateToSave: any = { ...state };
      delete stateToSave.messages;
      delete stateToSave.playgroundMessages;
      
      await setDoc(doc(db, 'users', userId), stateToSave, { merge: true });
    } catch (e) {
      console.error('[Sync] Failed to sync to Firestore:', e);
    }
  },

  async getState(userId: string): Promise<any | null> {
    if (!userId) return null;
    try {
      const docSnap = await getDoc(doc(db, 'users', userId));
      return docSnap.exists() ? docSnap.data() : null;
    } catch (e) {
      console.error('[Sync] Failed to fetch from Firestore:', e);
      return null;
    }
  },

  async saveWorkspace(userId: string, workspaceData: any): Promise<void> {
    if (!userId) return;
    try {
      await setDoc(doc(db, 'workspaces', userId), workspaceData, { merge: true });
    } catch (e) {
      console.error('[Sync] Failed to sync workspace to Firestore:', e);
    }
  },

  async getWorkspace(userId: string): Promise<any | null> {
    if (!userId) return null;
    try {
      const docSnap = await getDoc(doc(db, 'workspaces', userId));
      return docSnap.exists() ? docSnap.data() : null;
    } catch (e) {
      console.error('[Sync] Failed to fetch workspace from Firestore:', e);
      return null;
    }
  }
};
