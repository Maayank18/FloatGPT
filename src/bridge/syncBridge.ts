import { db, doc, onSnapshot } from '../lib/firebase';
import { SyncMerger } from '../sync/merger';
import { syncBus } from '../notifications/bus';

/**
 * The SyncBridge connects the remote Firebase Firestore database to the local Zustand store.
 * It ensures that changes from FloatOrb (Electron) immediately reflect in Playground (Browser) and vice versa.
 * 
 * CRITICAL: The merger preserves local transcripts (messages, playgroundMessages)
 * so that cross-surface sync never overwrites chat history.
 */
export class SyncBridge {
  private unsubscribe: (() => void) | null = null;
  private userId: string | null = null;
  private lastLocalWriteTime: number = 0;

  constructor(private getLocalState: () => any, private setLocalState: (state: any) => void) {}

  /** Mark that a local write just happened so we can debounce the incoming snapshot */
  markLocalWrite() {
    this.lastLocalWriteTime = Date.now();
  }

  /**
   * Starts listening to remote changes for the given user.
   */
  connect(userId: string) {
    if (this.userId === userId) return;
    this.disconnect();
    
    this.userId = userId;
    const docRef = doc(db, 'users', userId);

    console.log('[SyncBridge] Connected to workspace for user:', userId);
    
    this.unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        // Skip snapshots that arrive right after our own local write
        // to prevent echo-back overwrite loops
        const timeSinceWrite = Date.now() - this.lastLocalWriteTime;
        if (timeSinceWrite < 2000) {
          console.log('[SyncBridge] Skipping echo snapshot (local write was', timeSinceWrite, 'ms ago)');
          return;
        }

        const remoteData = docSnap.data();
        
        // Always process updates to ensure state is completely in sync
        const currentState = this.getLocalState();
        const mergedState = SyncMerger.merge(currentState, remoteData);
        
        this.setLocalState(mergedState);
        syncBus.emit({ type: 'REMOTE_UPDATE_RECEIVED' });
      }
    }, (error) => {
      console.error('[SyncBridge] Sync error:', error);
      syncBus.emit({ type: 'SYNC_ERROR', payload: error });
    });
  }

  /**
   * Stops listening to remote changes.
   */
  disconnect() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      this.userId = null;
      console.log('[SyncBridge] Disconnected');
    }
  }
}
