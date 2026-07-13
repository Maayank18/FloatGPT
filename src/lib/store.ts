import { create } from 'zustand';
import { AppState, INITIAL_STATE, DailySession } from '../types';
import { RecoveryService } from './recovery';

const SYNC_URL = '/api/state';

function getSessionId(date: Date) {
  return date.toISOString().split('T')[0];
}

interface AppStore {
  state: AppState;
  isLoaded: boolean;
  setState: (action: AppState | ((prev: AppState) => AppState)) => void;
  syncState: (state: AppState) => void;
  init: () => Promise<void>;
  resetStore: () => void;
  generateId: () => string;
}

export const useAppStore = create<AppStore>((setStore, getStore) => ({
  state: INITIAL_STATE,
  isLoaded: false,

  setState: (action) => {
    setStore((currentStore) => {
      const nextState = typeof action === 'function' ? action(currentStore.state) : action;
      const recoveredState = RecoveryService.analyzeAndRecover(nextState);
      
      // Persist to Centralized Backend asynchronously
      fetch(SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recoveredState),
      }).catch(e => console.error('Failed to sync to backend:', e));

      return { state: recoveredState };
    });
  },

  syncState: (newState) => {
    setStore({ state: newState });
  },

  init: async () => {
    // Force loading screen to disappear after 5s max as a fallback
    const fallbackTimer = setTimeout(() => {
       useAppStore.setState({ isLoaded: true });
    }, 5000);

    try {
      const res = await fetch(SYNC_URL);
      const stored = await res.json();
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

        let loadedState: AppState = {
          ...INITIAL_STATE,
          ...stored,
          goals: (stored.goals || INITIAL_STATE.goals).map(sanitizeTask),
          projects: (stored.projects || INITIAL_STATE.projects).map(sanitizeTask),
          tasks: (stored.tasks || INITIAL_STATE.tasks).map(sanitizeTask).filter((t: any) => {
             if (!t.deadlineAt && t.createdAt < sessionBoundaryMs && t.status !== 'Active' && t.status !== 'In Progress') {
               return false;
             }
             return true;
          }),
          settings: { ...INITIAL_STATE.settings, ...stored.settings },
          notifications: stored.notifications || INITIAL_STATE.notifications,
          knowledge: stored.knowledge || INITIAL_STATE.knowledge,
          metrics: { ...INITIAL_STATE.metrics, ...(stored.metrics || {}) },
          uiState: { ...INITIAL_STATE.uiState, ...(stored.uiState || {}) },
        };
        
        const todayId = getSessionId(new Date());
        if (loadedState.sessionId !== todayId) {
          loadedState = performRollover(loadedState, todayId);
        }
        
        clearTimeout(fallbackTimer);
        setStore({ state: loadedState, isLoaded: true });
      } else {
        clearTimeout(fallbackTimer);
        setStore({ isLoaded: true });
      }
    } catch (e) {
      clearTimeout(fallbackTimer);
      console.error('Failed to load state from backend API', e);
      setStore({ isLoaded: true });
    }
  },

  resetStore: () => {
    fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(INITIAL_STATE),
    }).then(() => window.location.reload());
  },

  generateId: () => Math.random().toString(36).substring(2, 9),
}));

// Setup Rollover Interval externally so it doesn't clutter React lifecycle
setInterval(() => {
  const store = useAppStore.getState();
  if (!store.isLoaded) return;
  const todayId = getSessionId(new Date());
  if (store.state.sessionId !== todayId) {
    store.setState((prev) => performRollover(prev, todayId));
  }
}, 60000);

// Setup Polling Interval to keep Desktop Orb synced with the Unified Backend
setInterval(async () => {
  const store = useAppStore.getState();
  if (!store.isLoaded) return;
  try {
    const res = await fetch(SYNC_URL);
    if (!res.ok) return;
    const stored = await res.json();
    if (stored && JSON.stringify(stored) !== JSON.stringify(store.state)) {
       store.syncState(stored);
    }
  } catch (e) {
    // silently ignore polling errors
  }
}, 3000);

export function performRollover(state: AppState, newSessionId: string): AppState {
  const now = Date.now();
  
  const archivedSession: DailySession = {
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

  const updatedPast = [archivedSession, ...state.pastSessions].slice(0, 4);

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
