/**
 * FloatGPT — Continuity Intelligence
 * 
 * Deterministically reconstructs "Where was I?" and "What matters now?"
 * from structured workspace entities (Projects, Tasks, Goals) without hallucinations.
 */

import { Task, Project, Goal } from '../types';

export interface ContinuityState {
  activeGoal?: Goal | null;
  activeProject?: Project | null;
  lastCompletedTask?: Task | null;
  currentBlocker?: Task | null;
  nextRecommendedTask?: Task | null;
  summary: string;
}

export interface PrioritizedTaskItem {
  task: Task;
  score: number;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
}

export class ContinuityService {
  /**
   * Reconstructs the user's active work state ("Where was I?").
   */
  static reconstructWhereWasI(state: {
    goals?: Goal[];
    projects?: Project[];
    tasks?: Task[];
    activeProjectId?: string;
  }): ContinuityState {
    const goals = state.goals || [];
    const projects = state.projects || [];
    const tasks = state.tasks || [];

    // 1. Determine active project
    let activeProject: Project | null = null;
    if (state.activeProjectId) {
      activeProject = projects.find(p => p.id === state.activeProjectId) || null;
    }
    if (!activeProject && projects.length > 0) {
      // Find project with latest activity
      const activeProjects = projects.filter(p => p.status !== 'Completed' && p.status !== 'Archived');
      const candidateList = activeProjects.length > 0 ? activeProjects : projects;
      activeProject = candidateList.slice().sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))[0] || null;
    }

    // 2. Determine active goal
    let activeGoal: Goal | null = null;
    if (activeProject && activeProject.goalId) {
      activeGoal = goals.find(g => g.id === activeProject.goalId) || null;
    }
    if (!activeGoal && goals.length > 0) {
      activeGoal = goals.filter(g => g.status !== 'Completed' && g.status !== 'Archived')
        .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))[0] || null;
    }

    // 3. Relevant tasks
    const relevantTasks = activeProject 
      ? tasks.filter(t => t.projectId === activeProject.id)
      : tasks;

    // 4. Last completed task
    const completedTasks = relevantTasks
      .filter(t => t.status === 'Completed')
      .sort((a, b) => (b.completedAt || b.updatedAt || 0) - (a.completedAt || a.updatedAt || 0));
    const lastCompletedTask = completedTasks[0] || null;

    // 5. Current blocker (has unresolved dependencies or flagged)
    const openTasks = relevantTasks.filter(t => t.status !== 'Completed' && t.status !== 'Archived');
    const blockedTasks = openTasks.filter(t => t.dependencies && t.dependencies.length > 0);
    const currentBlocker = blockedTasks[0] || null;

    // 6. Next recommended task
    // Prefer 'In Progress' or 'Active', then 'Planned'
    const inProgressTasks = openTasks.filter(t => t.status === 'In Progress' || t.status === 'Active');
    const plannedTasks = openTasks.filter(t => t.status === 'Planned' || t.status === 'Inbox');
    const nextRecommendedTask = inProgressTasks[0] || plannedTasks[0] || null;

    // 7. Compose deterministic summary
    const summaryParts: string[] = [];
    if (activeProject) {
      summaryParts.push(`Working on project: "${activeProject.title}".`);
    }
    if (lastCompletedTask) {
      summaryParts.push(`Last completed task was "${lastCompletedTask.title}".`);
    }
    if (currentBlocker) {
      summaryParts.push(`Blocker identified on "${currentBlocker.title}" (${currentBlocker.dependencies?.length} dependency).`);
    }
    if (nextRecommendedTask) {
      summaryParts.push(`Next recommended action is "${nextRecommendedTask.title}".`);
    } else {
      summaryParts.push(`No pending tasks remaining in current project.`);
    }

    return {
      activeGoal,
      activeProject,
      lastCompletedTask,
      currentBlocker,
      nextRecommendedTask,
      summary: summaryParts.join(' ')
    };
  }

  /**
   * Deterministically prioritizes tasks for "What matters now?".
   */
  static rankWhatMattersNow(
    tasks: Task[],
    options?: { referenceTime?: number }
  ): PrioritizedTaskItem[] {
    const now = options?.referenceTime ?? Date.now();
    const openTasks = tasks.filter(t => t.status !== 'Completed' && t.status !== 'Archived');

    const prioritized: PrioritizedTaskItem[] = [];

    for (const task of openTasks) {
      let score = 50; // base score
      let urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      let reason = 'Normal task progression';

      // Factor 1: Imminent Deadlines (< 12 hours = CRITICAL, < 24 hours = HIGH)
      if (task.deadlineAt) {
        const timeToDeadline = task.deadlineAt - now;
        if (timeToDeadline > 0 && timeToDeadline <= 12 * 60 * 60 * 1000) {
          score += 50;
          urgency = 'CRITICAL';
          const hrs = Math.max(1, Math.round(timeToDeadline / (60 * 60 * 1000)));
          reason = `Critical deadline in ${hrs} hour${hrs > 1 ? 's' : ''}`;
        } else if (timeToDeadline > 0 && timeToDeadline <= 24 * 60 * 60 * 1000) {
          score += 35;
          urgency = 'HIGH';
          const hrs = Math.round(timeToDeadline / (60 * 60 * 1000));
          reason = `Approaching deadline in ${hrs} hours`;
        } else if (timeToDeadline < 0) {
          score += 40;
          urgency = 'HIGH';
          reason = 'Overdue task requires immediate recovery';
        }
      }

      // Factor 2: Active status (In Progress > Planned)
      if (task.status === 'In Progress') {
        score += 20;
        if (urgency === 'MEDIUM') {
          urgency = 'HIGH';
          reason = 'Currently active in-progress task';
        }
      }

      // Factor 3: Priority tag if explicitly declared
      if (task.priority === 'High' || task.priority === 'Critical') {
        score += 15;
      }

      // Factor 4: Blocked penalty
      if (task.dependencies && task.dependencies.length > 0) {
        score -= 10;
        reason += ' (Blocked by dependencies)';
      }

      prioritized.push({
        task,
        score,
        urgency,
        reason
      });
    }

    return prioritized.sort((a, b) => b.score - a.score);
  }
}
