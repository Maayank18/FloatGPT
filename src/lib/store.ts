import React, { useState, useEffect } from 'react';
import { AppState, INITIAL_STATE, DailySession } from '../types';
import { RecoveryService } from './recovery';

const STORAGE_KEY = 'floatgpt_storage_v1';

function getSessionId(date: Date) {
  return date.toISOString().split('T')[0];
}

export function useAppStore() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Sanitize timestamps
        const nowMs = Date.now();
        const sanitizeTime = (t: any) => {
          if (!t) return undefined;
          if (typeof t === 'string') {
            const parsed = Date.parse(t);
            if (!isNaN(parsed)) t = parsed;
            else return undefined;
          }
          if (typeof t === 'number') {
            // If it's a Unix timestamp in seconds, convert to ms
            if (t < 2000000000 && t > 1000000000) t = t * 1000;
            // If it's more than 10 years in future, drop
            if (t > nowMs + 1000 * 60 * 60 * 24 * 365 * 10) return undefined;
            // If it's a deadline that is more than 30 days in the past, drop it to prevent absurd overdue values
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
          const sanitized = {
            ...t,
            createdAt: sanitizeTime(t.createdAt),
            updatedAt: sanitizeTime(t.updatedAt),
            deadlineAt: sanitizeTime(t.deadlineAt),
            completedAt: sanitizeTime(t.completedAt),
            estimatedEffort: effort,
          };
          return sanitized;
        };

        const sessionBoundaryMs = nowMs - 1000 * 60 * 60 * 24;

        let loadedState = {
          ...INITIAL_STATE,
          ...parsed,
          goals: (parsed.goals || INITIAL_STATE.goals).map(sanitizeTask),
          projects: (parsed.projects || INITIAL_STATE.projects).map(sanitizeTask),
          tasks: (parsed.tasks || INITIAL_STATE.tasks).map(sanitizeTask).filter((t: any) => {
             // Session Filter: drop tasks that are old, have no deadline, and are not explicitly active
             if (!t.deadlineAt && t.createdAt < sessionBoundaryMs && t.status !== 'Active' && t.status !== 'In Progress') {
               return false;
             }
             return true;
          }),
          risks: parsed.risks || INITIAL_STATE.risks,
          resources: parsed.resources || INITIAL_STATE.resources,
          history: parsed.history || INITIAL_STATE.history,
          messages: parsed.messages || INITIAL_STATE.messages,
          focusMode: parsed.focusMode || INITIAL_STATE.focusMode,
          settings: { ...INITIAL_STATE.settings, ...parsed.settings },
          executionProfile: parsed.executionProfile || INITIAL_STATE.executionProfile,
          recoveryState: parsed.recoveryState || INITIAL_STATE.recoveryState,
          pastSessions: parsed.pastSessions || INITIAL_STATE.pastSessions,
          sessionId: parsed.sessionId || INITIAL_STATE.sessionId,
          sessionDate: parsed.sessionDate || INITIAL_STATE.sessionDate,
        };
        
        // Initial rollover check on load
        const todayId = getSessionId(new Date());
        if (loadedState.sessionId !== todayId) {
          loadedState = performRollover(loadedState, todayId);
        }
        
        return loadedState;
      }
      return INITIAL_STATE;
    } catch (e) {
      console.error('Failed to load state from local storage', e);
      return INITIAL_STATE;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state to local storage', e);
    }
  }, [state]);

  // Check for day rollover every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const todayId = getSessionId(new Date());
      setState((prev) => {
        if (prev.sessionId !== todayId) {
          return performRollover(prev, todayId);
        }
        return prev;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const resetStore = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const setRecoveredState: React.Dispatch<React.SetStateAction<AppState>> = (action) => {
    setState((prevState) => {
      const nextState = typeof action === 'function' ? action(prevState) : action;
      return RecoveryService.analyzeAndRecover(nextState);
    });
  };

  return {
    state,
    setState: setRecoveredState,
    resetStore,
    generateId,
  };
}

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
    recommendations: [...state.recommendations],
    history: [...state.history],
  };

  // Keep last 4 days
  const updatedPast = [archivedSession, ...state.pastSessions].slice(0, 4);

  // Preserve goals, projects, history, settings, resources.
  // We keep tasks too, but what about chat? "reset the active chat/task workspace for the new day"
  // Wait, if we keep tasks... The prompt says:
  // "Active tasks for the current day should appear in today’s workspace.
  // Completed tasks should remain visible in that day’s history for a limited period if needed.
  // A task should not leak confusingly across multiple days unless explicitly carried forward."
  const carriedForwardTasks = state.tasks
    .filter(t => t.status !== 'Completed' && t.status !== 'Archived')
    .map(t => ({ ...t, carriedOver: true }));

  const nextState = {
    ...state,
    sessionId: newSessionId,
    sessionDate: now,
    pastSessions: updatedPast,
    messages: [], // Clear chat
    tasks: carriedForwardTasks, // Keep carried forward tasks
    recommendations: [], 
    recoveryState: {
      status: 'Healthy' as const,
      estimatedRecoveryHours: 0,
      tasksDeferredCount: 0,
      missionConfidencePercent: 100,
      isRecovering: false,
    }
  };
  
  return RecoveryService.analyzeAndRecover(nextState);
}
