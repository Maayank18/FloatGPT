import { AppState, Task, Project, Goal } from '../../types';
import type { AIIntentMode } from '../router';

/**
 * Compresses the application state specifically for the active AI mode.
 * Reduces token waste by stripping irrelevant data.
 */
export function buildModeSpecificContext(state: AppState, mode: AIIntentMode): any {
  // If chatting, the AI needs almost zero state, just chat history (handled elsewhere).
  if (mode === 'general_chat') {
    return {
      activeFocus: state.focusModeState?.active || false,
      productivitySensitivity: state.settings?.productivity?.pulseSensitivity
    };
  }

  // If focus mode, only send the top most critical tasks.
  if (mode === 'focus_mode') {
    const activeTasks = (state.tasks || []).filter(t => t.status !== 'Completed' && t.status !== 'Archived');
    
    // Quick heuristic: overdue or highest priority
    const topTasks = activeTasks
      .sort((a, b) => {
        if (a.deadlineAt && b.deadlineAt) return a.deadlineAt - b.deadlineAt;
        if (a.deadlineAt) return -1;
        if (b.deadlineAt) return 1;
        return 0;
      })
      .slice(0, 3)
      .map(t => ({ id: t.id, title: t.title, deadlineAt: t.deadlineAt, priority: t.priority }));

    return {
      topTasks,
      habitProfile: state.habitProfile // Focus mode benefits from knowing focusWindow
    };
  }

  // For planning and reviewing (plan_create, plan_update, plan_query),
  // send the structured hierarchy but strip out noisy metadata.
  return {
    goals: state.goals?.map((g) => ({ 
      id: g.id, 
      title: g.title, 
      progress: g.progress, 
      status: g.status 
    })),
    projects: state.projects?.map((p) => ({ 
      id: p.id, 
      title: p.title, 
      goalId: p.goalId, 
      progress: p.progress, 
      status: p.status 
    })),
    tasks: state.tasks?.filter((t) => t.status !== 'Completed' && t.status !== 'Archived').map((t) => ({ 
      id: t.id, 
      title: t.title, 
      projectId: t.projectId, 
      status: t.status, 
      priority: t.priority,
      deadlineAt: t.deadlineAt
    })),
    executionProfileSummary: state.executionProfile ? {
      planningAccuracy: state.executionProfile.planningAccuracyPercent + '%',
      averageDelay: state.executionProfile.averageDelayMinutes + ' min',
      preferredWorkingHours: state.executionProfile.preferredWorkingHours,
      frequentlyDelayedCategories: state.executionProfile.frequentlyDelayedCategories,
    } : null
  };
}
