import { AppState, Task, Project, Goal } from '../../types';
import type { AIIntentMode } from '../router';

export interface ActiveContextCapsule {
  activeGoal?: { id: string; title: string; progress: number };
  topUrgentTasks?: Array<{ id: string; title: string; deadlineAt?: number; priority: string }>;
  activeFocus?: boolean;
  goals?: Array<{ id: string; title: string; progress: number; status: string }>;
  projects?: Array<{ id: string; title: string; goalId?: string; progress: number; status: string }>;
  tasks?: Array<{ id: string; title: string; projectId?: string; status: string; priority?: string; deadlineAt?: number }>;
}

/**
 * Compresses the application state into an Active-Context Capsule.
 * Drastically reduces token consumption by omitting archived and completed noise.
 */
export function buildModeSpecificContext(state: AppState, mode: AIIntentMode): ActiveContextCapsule {
  const activeTasks = (state.tasks || []).filter((t: Task) => t.status !== 'Completed' && t.status !== 'Archived');
  const activeGoals = (state.goals || []).filter((g: Goal) => g.status !== 'Completed' && g.status !== 'Archived');
  const activeProjects = (state.projects || []).filter((p: Project) => p.status !== 'Completed' && p.status !== 'Archived');

  // Lightweight capsule for conversational modes
  if (mode === 'general_chat' || mode === 'summary' || mode === 'explain_priority') {
    const topUrgent = activeTasks
      .sort((a, b) => {
        if (a.deadlineAt && b.deadlineAt) return a.deadlineAt - b.deadlineAt;
        if (a.deadlineAt) return -1;
        if (b.deadlineAt) return 1;
        return 0;
      })
      .slice(0, 3)
      .map(t => ({ id: t.id, title: t.title, deadlineAt: t.deadlineAt, priority: t.priority || 'Medium' }));

    const topGoal = activeGoals[0];

    return {
      activeGoal: topGoal ? { id: topGoal.id, title: topGoal.title, progress: topGoal.progress } : undefined,
      topUrgentTasks: topUrgent.length > 0 ? topUrgent : undefined,
      activeFocus: state.focusModeState?.active || false
    };
  }

  // Focus mode capsule
  if (mode === 'focus_mode') {
    const topTasks = activeTasks
      .sort((a, b) => {
        if (a.deadlineAt && b.deadlineAt) return a.deadlineAt - b.deadlineAt;
        if (a.deadlineAt) return -1;
        if (b.deadlineAt) return 1;
        return 0;
      })
      .slice(0, 3)
      .map(t => ({ id: t.id, title: t.title, deadlineAt: t.deadlineAt, priority: t.priority || 'High' }));

    return {
      topUrgentTasks: topTasks,
      activeFocus: true
    };
  }

  // Planning / Mutator modes: Compact structured hierarchy
  return {
    goals: activeGoals.slice(0, 4).map(g => ({
      id: g.id,
      title: g.title,
      progress: g.progress,
      status: g.status || 'Active'
    })),
    projects: activeProjects.slice(0, 8).map(p => ({
      id: p.id,
      title: p.title,
      goalId: p.goalId,
      progress: p.progress,
      status: p.status || 'Active'
    })),
    tasks: activeTasks.slice(0, 15).map(t => ({
      id: t.id,
      title: t.title,
      projectId: t.projectId,
      status: t.status,
      priority: t.priority,
      deadlineAt: t.deadlineAt
    }))
  };
}
