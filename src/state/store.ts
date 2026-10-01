import { create } from 'zustand';
import { AppState, INITIAL_STATE } from '../types';
import { RecoveryService } from '../lib/recovery';
import { normalizeAppState } from './schema';
import { auth, signOut } from '../lib/firebase';
import { AccountSessionUser, restoreAccountSession, subscribeAccountSession } from '../lib/accountSession';
import { FirebaseAdapter } from '../persistence/firebaseAdapter';
import { LocalAdapter } from '../persistence/localAdapter';
import { SyncBridge } from '../bridge/syncBridge';
import { SyncMerger } from '../sync/merger';
import { eventJournal } from '../memory/eventJournal';
import '../memory/summarizer'; // Initialize summarizer service
import '../analytics/habitEngine'; // Initialize habit engine

interface AppStore {
  state: AppState;
  isLoaded: boolean;
  user: AccountSessionUser | null;
  setState: (action: AppState | ((prev: AppState) => AppState)) => void;
  syncState: (state: AppState) => void;
  init: () => Promise<void>;
  resetStore: () => void;
  generateId: () => string;
}

function getSessionId(date: Date) {
  return date.toISOString().split('T')[0];
}

// 1. Create a singleton bridge
// We'll initialize it down in the store initialization
let syncBridge: SyncBridge | null = null;

let localSaveTimer: any = null;
let cloudSaveTimer: any = null;
let latestLocalState: AppState | null = null;
let persistGeneration = 0;
let hadAuthenticatedUser = false;

const debouncedSaveLocal = (state: AppState) => {
  const generation = persistGeneration;
  // Always write the newest snapshot. A delayed save must not put an older file list back.
  latestLocalState = state;
  if (localSaveTimer) clearTimeout(localSaveTimer);
  LocalAdapter.saveStateLocally(state).then(() => {
    if (generation !== persistGeneration) void LocalAdapter.clearState();
  });
  localSaveTimer = setTimeout(() => {
    if (generation !== persistGeneration) return;
    if (latestLocalState) {
      LocalAdapter.saveStateLocally(latestLocalState).then(() => {
        if (generation !== persistGeneration) void LocalAdapter.clearState();
      });
    }
  }, 100);
};

function wipeLocalSession() {
  persistGeneration += 1;
  if (localSaveTimer) clearTimeout(localSaveTimer);
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  localSaveTimer = null;
  cloudSaveTimer = null;
  latestLocalState = null;
  void LocalAdapter.clearState();
}

const debouncedSaveCloud = (userId: string, state: AppState) => {
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    if (syncBridge) syncBridge.markLocalWrite();
    FirebaseAdapter.saveState(userId, state);
  }, 300);
};

export const useAppStore = create<AppStore>((setStore, getStore) => ({
  state: INITIAL_STATE,
  isLoaded: false,
  user: null,

  setState: (action) => {
    setStore((currentStore) => {
      const nextState = typeof action === 'function' ? action(currentStore.state) : action;
      const recoveredState = RecoveryService.analyzeAndRecover(nextState);
      
      // Journaling: detect newly completed tasks
      const prevTasks = currentStore.state.tasks || [];
      const nextTasks = recoveredState.tasks || [];
      for (const nextTask of nextTasks) {
        if (nextTask.status === 'Completed') {
          const prevTask = prevTasks.find(t => t.id === nextTask.id);
          if (!prevTask || prevTask.status !== 'Completed') {
            eventJournal.recordEvent('task_completed', 'orb', nextTask);
          }
        }
      }

      // Persist to local IndexedDB with high-efficiency debouncing (Priority 1)
      debouncedSaveLocal(recoveredState);

      // Persist to Firebase Firestore with batched debouncing (Priority 2)
      const user = currentStore.user;
      if (user) {
        debouncedSaveCloud(user.uid, recoveredState);
      }

      return { state: recoveredState };
    });
  },

  syncState: (newState) => {
    setStore({ state: normalizeAppState(newState) });
  },

  init: async () => {
    if (!syncBridge) {
      syncBridge = new SyncBridge(
        () => getStore().state,
        (mergedState: AppState) => setStore({ state: mergedState })
      );
    }

    // 1. Instant zero-latency local startup (Priority 1: IndexedDB at t=0ms)
    try {
      const localStored = await LocalAdapter.getStateLocally();
      if (localStored) {
        setStore({ state: normalizeAppState(localStored), isLoaded: true });
      } else {
        setStore({ isLoaded: true });
      }
    } catch (e) {
      setStore({ isLoaded: true });
    }

    // 2. Account session. Chat stays on this device. Profile data loads from MongoDB.
    signOut(auth).catch(() => {});
    const applyAccount = async (user: AccountSessionUser | null) => {
      setStore({ user });
      
      if (user) {
        hadAuthenticatedUser = true;
        try {
          // Fetch from Firebase in background to ensure cloud sync
          const stored = await FirebaseAdapter.getState(user.uid);
          
          if (stored) {
            const nowMs = Date.now();
            const sanitizeTime = (t: any) => {
              if (!t) return undefined;
              if (typeof t === 'string') {
                const parsed = Date.parse(t);
                if (!isNaN(parsed)) t = parsed;
                else return undefined;
              }
              if (typeof t === 'number') {
                if (t < 2000000000 && t > 1000000000) t = t * 1000;
                if (t > nowMs + 1000 * 60 * 60 * 24 * 365 * 10) return undefined;
                if (t < nowMs - 1000 * 60 * 60 * 24 * 30) return undefined;
                return t;
              }
              return undefined;
            };

            const sanitizeTask = (t: any) => {
              let effort = t.estimatedEffort;
              if (typeof effort === 'string' && (effort.toLowerCase().includes('overdue') || effort.toLowerCase().includes('remaining'))) {
                effort = undefined;
              }
              return {
                ...t,
                createdAt: sanitizeTime(t.createdAt),
                updatedAt: sanitizeTime(t.updatedAt),
                deadlineAt: sanitizeTime(t.deadlineAt),
                completedAt: sanitizeTime(t.completedAt),
                estimatedEffort: effort,
              };
            };

            const sessionBoundaryMs = nowMs - 1000 * 60 * 60 * 24;

            let loadedState: AppState = normalizeAppState({
              ...stored,
              goals: (Array.isArray(stored.goals) ? stored.goals : INITIAL_STATE.goals).map(sanitizeTask),
              projects: (Array.isArray(stored.projects) ? stored.projects : INITIAL_STATE.projects).map(sanitizeTask),
              tasks: (Array.isArray(stored.tasks) ? stored.tasks : INITIAL_STATE.tasks).map(sanitizeTask).filter((t: any) => {
                 if (!t.deadlineAt && t.createdAt < sessionBoundaryMs && t.status !== 'Active' && t.status !== 'In Progress') {
                   return false;
                 }
                 return true;
              }),
            });
            
            // CRITICAL: Merge local state with remote state so locally completed tasks/plans are NEVER lost!
            const currentLocalState = getStore().state;
            const mergedState = SyncMerger.merge(currentLocalState, loadedState);

            setStore({ state: mergedState, isLoaded: true });
            
            // Re-save the merged/latest cloud state back to local DB and Firestore
            LocalAdapter.saveStateLocally(mergedState);
            FirebaseAdapter.saveState(user.uid, mergedState);
          }
          
          if (syncBridge) syncBridge.disconnect();

        } catch (err) {
          console.error('Failed to load account profile:', err);
        } finally {
          setStore({ isLoaded: true });
        }
      } else if (hadAuthenticatedUser) {
        hadAuthenticatedUser = false;
        wipeLocalSession();
        setStore({ state: INITIAL_STATE, isLoaded: true, user: null });
        if (syncBridge) {
          syncBridge.disconnect();
        }
      } else {
        setStore({ isLoaded: true });
        if (syncBridge) {
          syncBridge.disconnect();
        }
      }
    };
    const current = await restoreAccountSession();
    if (current) hadAuthenticatedUser = true;
    await applyAccount(current);
    subscribeAccountSession((user) => {
      void applyAccount(user);
    });
  },

  resetStore: () => {
    const store = getStore();
    if (store.user) {
      FirebaseAdapter.saveState(store.user.uid, INITIAL_STATE)
        .then(() => window.location.reload());
    } else {
      setStore({ state: INITIAL_STATE });
      window.location.reload();
    }
  },

  generateId: () => Math.random().toString(36).substring(2, 9),
}));

export function performRollover(state: AppState, newSessionId: string): AppState {
  const now = Date.now();
  
  // Extract a meaningful title from the first user question or task
  const firstUserMsg = (state.messages || []).find(m => m.role === 'user');
  let sessionTitle = '';
  if (firstUserMsg && firstUserMsg.content) {
    const clean = firstUserMsg.content.trim().replace(/^[\r\n\s]+/, '');
    sessionTitle = clean.length > 40 ? clean.slice(0, 40) + '...' : clean;
  } else if (state.goals && state.goals.length > 0 && state.goals[0].title) {
    sessionTitle = state.goals[0].title;
  } else if (state.tasks && state.tasks.length > 0 && state.tasks[0].title) {
    sessionTitle = state.tasks[0].title;
  }

  const hasContent = (state.messages && state.messages.length > 0) || (state.tasks && state.tasks.length > 0) || (state.goals && state.goals.length > 0);

  const archivedSession = hasContent ? {
    id: state.sessionId,
    title: sessionTitle || 'Saved Session',
    date: state.sessionDate || now,
    goals: [...state.goals],
    projects: [...state.projects],
    tasks: [...state.tasks],
    risks: [...state.risks],
    messages: [...state.messages],
    playgroundMessages: [...(state.playgroundMessages || [])],
    recommendations: [...state.recommendations],
    history: [...state.history],
  } : null;

  const updatedPast = archivedSession 
    ? [archivedSession, ...(state.pastSessions || [])].slice(0, 20)
    : (state.pastSessions || []);

  const carriedForwardTasks = state.tasks
    .filter(t => t.status !== 'Completed' && t.status !== 'Archived')
    .map(t => ({ ...t, carriedOver: true }));

  const nextState: AppState = {
    ...state,
    sessionId: newSessionId,
    sessionDate: now,
    pastSessions: updatedPast,
    messages: [], 
    tasks: carriedForwardTasks, 
    recommendations: [],
    viewingSessionId: null,
    recoveryState: {
      status: 'Healthy',
      estimatedRecoveryHours: 0,
      tasksDeferredCount: 0,
      missionConfidencePercent: 100,
      isRecovering: false,
    }
  };
  
  return RecoveryService.analyzeAndRecover(nextState);
}

