import { AppState } from '../types';
import { normalizeAppState } from '../state/schema';

export const SyncMerger = {
  /**
   * Merges an incoming Firestore snapshot with the local state.
   * 
   * RULES:
   * 1. Transcripts (messages, playgroundMessages) are NEVER overwritten by remote.
   * 2. Shared workspace data (goals, tasks, projects, settings) is accepted from remote.
   * 3. Analytics/habit data is preserved from local if remote is empty/stale.
   * 4. History and pastSessions use the longer array (whichever has more data).
   */
  merge(localState: AppState, remotePayload: any): AppState {
    if (!remotePayload) return localState;
    
    // Always normalize the incoming payload to ensure no schemas are broken
    const normalizedRemote = normalizeAppState(remotePayload);

    // RULE 1: Never overwrite local transcripts with remote data unless remote is longer (e.g. on initial load)
    if ((normalizedRemote.messages?.length || 0) <= (localState.messages?.length || 0)) {
      normalizedRemote.messages = localState.messages;
    }
    if ((normalizedRemote.playgroundMessages?.length || 0) <= (localState.playgroundMessages?.length || 0)) {
      normalizedRemote.playgroundMessages = localState.playgroundMessages;
    }

    // RULE 3: Preserve local analytics if remote is empty/default
    if (localState.habitProfile?.focusWindow !== 'Unknown' && normalizedRemote.habitProfile?.focusWindow === 'Unknown') {
      normalizedRemote.habitProfile = localState.habitProfile;
    }
    if (localState.executionProfile?._completedTasksCount > 0 && normalizedRemote.executionProfile?._completedTasksCount === 0) {
      normalizedRemote.executionProfile = localState.executionProfile;
    }

    // RULE 4: Use whichever history has more entries
    if ((localState.history?.length || 0) > (normalizedRemote.history?.length || 0)) {
      normalizedRemote.history = localState.history;
    }
    if ((localState.pastSessions?.length || 0) > (normalizedRemote.pastSessions?.length || 0)) {
      normalizedRemote.pastSessions = localState.pastSessions;
    }

    // Preserve metrics if local has a more recent calculation
    if ((localState.metrics?.lastCalculatedAt || 0) > (normalizedRemote.metrics?.lastCalculatedAt || 0)) {
      normalizedRemote.metrics = localState.metrics;
    }

    return normalizedRemote;
  }
};
