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

    // RULE 5: Completed plans and tasks are strictly irreversible across local & remote
    if (localState.tasks || normalizedRemote.tasks) {
      const localTasks = localState.tasks || [];
      const remoteTasks = normalizedRemote.tasks || [];
      
      const mergedTasksMap = new Map<string, any>();
      for (const rt of remoteTasks) {
        mergedTasksMap.set(rt.id, { ...rt });
      }
      for (const lt of localTasks) {
        if (!mergedTasksMap.has(lt.id)) {
          mergedTasksMap.set(lt.id, { ...lt });
        } else {
          const existing = mergedTasksMap.get(lt.id)!;
          const isCompleted = lt.status === 'Completed' || lt.status === 'Archived' || existing.status === 'Completed' || existing.status === 'Archived';
          const status = (lt.status === 'Archived' || existing.status === 'Archived') ? 'Archived' : (isCompleted ? 'Completed' : (existing.status || lt.status));
          mergedTasksMap.set(lt.id, {
            ...existing,
            ...lt,
            status,
            completedAt: lt.completedAt || existing.completedAt || (isCompleted ? Date.now() : undefined),
            deadlineAt: lt.deadlineAt || existing.deadlineAt,
            priority: lt.priority || existing.priority,
          });
        }
      }
      normalizedRemote.tasks = Array.from(mergedTasksMap.values());
    }

    if (localState.projects || normalizedRemote.projects) {
      const localProjects = localState.projects || [];
      const remoteProjects = normalizedRemote.projects || [];
      const mergedProjectsMap = new Map<string, any>();
      for (const rp of remoteProjects) mergedProjectsMap.set(rp.id, { ...rp });
      for (const lp of localProjects) {
        if (!mergedProjectsMap.has(lp.id)) {
          mergedProjectsMap.set(lp.id, { ...lp });
        } else {
          const existing = mergedProjectsMap.get(lp.id)!;
          const isCompleted = lp.status === 'Completed' || lp.status === 'Archived' || existing.status === 'Completed' || existing.status === 'Archived';
          const status = (lp.status === 'Archived' || existing.status === 'Archived') ? 'Archived' : (isCompleted ? 'Completed' : (existing.status || lp.status));
          mergedProjectsMap.set(lp.id, {
            ...existing,
            ...lp,
            status,
            progress: Math.max(lp.progress || 0, existing.progress || 0)
          });
        }
      }

      const allTasks = normalizedRemote.tasks || [];
      normalizedRemote.projects = Array.from(mergedProjectsMap.values()).map(p => {
        const pTasks = allTasks.filter(t => t.projectId === p.id);
        if (pTasks.length > 0) {
          const completed = pTasks.filter(t => t.status === 'Completed' || t.status === 'Archived').length;
          const progress = Math.round((completed / pTasks.length) * 100);
          return {
            ...p,
            progress,
            status: progress === 100 ? 'Completed' : (p.status === 'Archived' ? 'Archived' : (progress > 0 ? 'Active' : p.status))
          };
        }
        return p;
      });
    }

    if (localState.goals || normalizedRemote.goals) {
      const localGoals = localState.goals || [];
      const remoteGoals = normalizedRemote.goals || [];
      const mergedGoalsMap = new Map<string, any>();
      for (const rg of remoteGoals) mergedGoalsMap.set(rg.id, { ...rg });
      for (const lg of localGoals) {
        if (!mergedGoalsMap.has(lg.id)) {
          mergedGoalsMap.set(lg.id, { ...lg });
        } else {
          const existing = mergedGoalsMap.get(lg.id)!;
          const isCompleted = lg.status === 'Completed' || lg.status === 'Archived' || existing.status === 'Completed' || existing.status === 'Archived';
          const status = (lg.status === 'Archived' || existing.status === 'Archived') ? 'Archived' : (isCompleted ? 'Completed' : (existing.status || lg.status));
          mergedGoalsMap.set(lg.id, {
            ...existing,
            ...lg,
            status,
            progress: Math.max(lg.progress || 0, existing.progress || 0)
          });
        }
      }

      const allProjects = normalizedRemote.projects || [];
      normalizedRemote.goals = Array.from(mergedGoalsMap.values()).map(g => {
        const gProjects = allProjects.filter(p => p.goalId === g.id);
        if (gProjects.length > 0) {
          const totalP = gProjects.reduce((acc, p) => acc + (p.progress || 0), 0);
          const progress = Math.round(totalP / gProjects.length);
          return {
            ...g,
            progress,
            status: progress === 100 ? 'Completed' : (g.status === 'Archived' ? 'Archived' : (progress > 0 ? 'Active' : g.status))
          };
        }
        return g;
      });
    }

    return normalizedRemote;
  }
};
