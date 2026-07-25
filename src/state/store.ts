import { create } from 'zustand';
import { AppState, INITIAL_STATE } from '../types';
import { RecoveryService } from '../lib/recovery';
import { normalizeAppState } from './schema';
import { auth, onAuthStateChanged } from '../lib/firebase';
import { User } from 'firebase/auth';
import { FirebaseAdapter } from '../persistence/firebaseAdapter';
import { SyncBridge } from '../bridge/syncBridge';
import { eventJournal } from '../memory/eventJournal';
import '../memory/summarizer'; // Initialize summarizer service
import '../analytics/habitEngine'; // Initialize habit engine

interface AppStore {
  state: AppState;
  isLoaded: boolean;
  user: User | null;
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
            eventJournal.recordEvent('task_completed', 'Orb', nextTask);
          }
        }
      }

      // Persist to Firebase Firestore if logged in
      const user = currentStore.user;
      if (user) {
        // Mark that we are about to write, so the SyncBridge skips the echo snapshot
        if (syncBridge) syncBridge.markLocalWrite();
        FirebaseAdapter.saveState(user.uid, recoveredState);
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

    // Force loading screen to disappear after 5s max as a fallback
    const fallbackTimer = setTimeout(() => {
       useAppStore.setState({ isLoaded: true });
    }, 5000);

    // Listen to Auth State
    onAuthStateChanged(auth, async (user) => {
      setStore({ user });
      
      if (user) {
        try {
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
            
            const todayId = getSessionId(new Date());
            if (!loadedState.sessionId.startsWith(todayId)) {
               loadedState = performRollover(loadedState, todayId);
            }
            
            clearTimeout(fallbackTimer);
            setStore({ state: loadedState, isLoaded: true });
          } else {
            // No doc exists yet for this user, start with fresh state
            clearTimeout(fallbackTimer);
            setStore({ state: INITIAL_STATE, isLoaded: true });
          }
          
          // Connect real-time synchronization bridge
          syncBridge!.connect(user.uid);

        } catch (err) {
          console.error('Failed to load state from Firestore:', err);
        } finally {
          clearTimeout(fallbackTimer);
          setStore({ isLoaded: true });
        }
      } else {
        // User is logged out, clear state to initial but mark as loaded
        clearTimeout(fallbackTimer);
        setStore({ state: INITIAL_STATE, isLoaded: true });
        if (syncBridge) {
          syncBridge.disconnect();
        }
      }
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
  
  const archivedSession = {
    id: state.sessionId,
    date: state.sessionDate,
    goals: [...state.goals],
    projects: [...state.projects],
    tasks: [...state.tasks],
    risks: [...state.risks],
    messages: [...state.messages],
    playgroundMessages: [...(state.playgroundMessages || [])],
    recommendations: [...state.recommendations],
    history: [...state.history],
  };

  const updatedPast = [archivedSession, ...state.pastSessions].slice(0, 10);

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

// Setup Rollover Interval externally so it doesn't clutter React lifecycle
setInterval(() => {
  const store = useAppStore.getState();
  if (!store.isLoaded) return;
  const todayId = getSessionId(new Date());
  if (!store.state.sessionId.startsWith(todayId)) {
    store.setState((prev) => performRollover(prev, todayId));
  }
}, 60000);

