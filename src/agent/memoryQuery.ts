/**
 * Flow Agent — Memory Query
 *
 * Reads from the live Zustand stores (useAppStore, useWorkspaceStore)
 * to answer natural-language questions about the user's workspace.
 *
 * Returns pre-formatted text answers. No AI model is needed for
 * structured queries — we just read the state and format it.
 */

import { useAppStore } from '../state/store';
import { useWorkspaceStore } from '../state/workspaceStore';
import { eventJournal } from '../memory/eventJournal';
import type { Task, Goal, Project } from '../types';

type QueryType =
  | 'today_tasks'
  | 'pending_work'
  | 'goals'
  | 'yesterday'
  | 'schedule'
  | 'habits'
  | 'momentum'
  | 'general';

/**
 * Execute a structured memory query and return a formatted answer.
 */
export function queryMemory(queryType: QueryType, rawQuery?: string): string {
  const state = useAppStore.getState().state;

  switch (queryType) {
    case 'today_tasks':
      return formatTodayTasks(state.tasks);
    case 'pending_work':
      return formatPendingWork(state.tasks);
    case 'goals':
      return formatGoals(state.goals, state.projects);
    case 'yesterday':
      return formatYesterday(state.pastSessions);
    case 'schedule':
      return formatSchedule(state.tasks);
    case 'habits':
      return formatHabits(state);
    case 'momentum':
      return formatMomentum(state);
    case 'general':
      return buildFullContext();
    default:
      return 'I couldn\'t understand that query. Try asking about your tasks, goals, schedule, or habits.';
  }
}

/**
 * Build a full workspace context string for AI-powered answers.
 */
export function buildFullContext(): string {
  const state = useAppStore.getState().state;
  const workspace = useWorkspaceStore.getState().memory;
  const recentEvents = eventJournal.getRecentEvents(20);

  const parts: string[] = [];

  // Active goals
  const activeGoals = state.goals.filter(g => g.status !== 'Archived' && g.status !== 'Completed');
  if (activeGoals.length > 0) {
    parts.push(`Active Goals:\n${activeGoals.map(g => `  • ${g.title} (${g.progress}% complete)`).join('\n')}`);
  }

  // Today's tasks
  const activeTasks = state.tasks.filter(t => t.status !== 'Completed' && t.status !== 'Archived');
  if (activeTasks.length > 0) {
    parts.push(`Current Tasks (${activeTasks.length}):\n${activeTasks.map(t => `  • [${t.status}] ${t.title}`).join('\n')}`);
  }

  // Completed today
  const completedToday = state.tasks.filter(t => t.status === 'Completed');
  if (completedToday.length > 0) {
    parts.push(`Completed Today: ${completedToday.length} task(s)`);
  }

  // Momentum
  parts.push(`Momentum Score: ${state.metrics.momentumScore}/100`);
  parts.push(`Recovery Status: ${state.recoveryState.status}`);

  // Recent workspace summaries
  if (workspace.recentSummaries.length > 0) {
    const recent = workspace.recentSummaries.slice(-5);
    parts.push(`Recent Activity:\n${recent.map(s => `  • [${s.source}] ${s.topic}: ${s.summary}`).join('\n')}`);
  }

  // Recent events
  if (recentEvents.length > 0) {
    const eventSummary = recentEvents.slice(-5).map(e => `  • ${e.type} from ${e.source}`).join('\n');
    parts.push(`Recent Events:\n${eventSummary}`);
  }

  return parts.join('\n\n');
}

// ─── Formatters ──────────────────────────────────────────────────

function formatTodayTasks(tasks: Task[]): string {
  const active = tasks.filter(t => t.status === 'Active' || t.status === 'In Progress');
  const completed = tasks.filter(t => t.status === 'Completed');
  const planned = tasks.filter(t => t.status === 'Planned');

  if (active.length === 0 && planned.length === 0 && completed.length === 0) {
    return 'You have no tasks for today. A clean slate — time to plan!';
  }

  const lines: string[] = [];

  if (active.length > 0) {
    lines.push(`🔥 Active (${active.length}):`);
    active.forEach(t => lines.push(`  • ${t.title}${t.priority ? ` [${t.priority}]` : ''}`));
  }

  if (planned.length > 0) {
    lines.push(`📋 Planned (${planned.length}):`);
    planned.forEach(t => lines.push(`  • ${t.title}`));
  }

  if (completed.length > 0) {
    lines.push(`✅ Completed (${completed.length}):`);
    completed.forEach(t => lines.push(`  • ${t.title}`));
  }

  return lines.join('\n');
}

function formatPendingWork(tasks: Task[]): string {
  const pending = tasks.filter(t =>
    t.status !== 'Completed' && t.status !== 'Archived'
  );

  if (pending.length === 0) {
    return 'All caught up! No pending work remaining.';
  }

  const withDeadline = pending.filter(t => t.deadlineAt).sort((a, b) => (a.deadlineAt! - b.deadlineAt!));
  const withoutDeadline = pending.filter(t => !t.deadlineAt);

  const lines: string[] = [`You have ${pending.length} pending task(s):\n`];

  if (withDeadline.length > 0) {
    lines.push('⏰ With deadlines:');
    withDeadline.forEach(t => {
      const deadline = new Date(t.deadlineAt!).toLocaleDateString();
      const isOverdue = t.deadlineAt! < Date.now();
      lines.push(`  • ${isOverdue ? '🚨 OVERDUE: ' : ''}${t.title} — due ${deadline}`);
    });
  }

  if (withoutDeadline.length > 0) {
    lines.push('\n📝 No deadline:');
    withoutDeadline.forEach(t => lines.push(`  • ${t.title} [${t.status}]`));
  }

  return lines.join('\n');
}

function formatGoals(goals: Goal[], projects: Project[]): string {
  const active = goals.filter(g => g.status !== 'Archived' && g.status !== 'Completed');

  if (active.length === 0) {
    return 'No active goals set. Consider creating some to guide your work!';
  }

  const lines: string[] = [`You have ${active.length} active goal(s):\n`];

  active.forEach(g => {
    lines.push(`🎯 ${g.title} — ${g.progress}% complete`);
    if (g.description) lines.push(`   ${g.description}`);

    const relatedProjects = projects.filter(p => p.goalId === g.id && p.status !== 'Archived');
    if (relatedProjects.length > 0) {
      relatedProjects.forEach(p => lines.push(`   └─ Project: ${p.title} (${p.progress}%)`));
    }
  });

  return lines.join('\n');
}

function formatYesterday(pastSessions: any[]): string {
  if (!pastSessions || pastSessions.length === 0) {
    return 'No session data from yesterday. This might be your first day!';
  }

  const yesterday = pastSessions[0];
  const completedTasks = (yesterday.tasks || []).filter((t: Task) => t.status === 'Completed');
  const totalTasks = (yesterday.tasks || []).length;

  const lines: string[] = [
    `📅 Yesterday's Session (${yesterday.id || 'Unknown date'}):\n`,
    `Tasks: ${completedTasks.length}/${totalTasks} completed`,
  ];

  if (completedTasks.length > 0) {
    lines.push('\nCompleted:');
    completedTasks.forEach((t: Task) => lines.push(`  ✅ ${t.title}`));
  }

  const carried = (yesterday.tasks || []).filter((t: Task) => t.status !== 'Completed' && t.status !== 'Archived');
  if (carried.length > 0) {
    lines.push('\nCarried over to today:');
    carried.forEach((t: Task) => lines.push(`  ⏩ ${t.title}`));
  }

  return lines.join('\n');
}

function formatSchedule(tasks: Task[]): string {
  const withDeadline = tasks
    .filter(t => t.deadlineAt && t.status !== 'Completed' && t.status !== 'Archived')
    .sort((a, b) => a.deadlineAt! - b.deadlineAt!);

  if (withDeadline.length === 0) {
    return 'No scheduled tasks with deadlines. Your calendar is clear!';
  }

  const now = Date.now();
  const lines: string[] = ['📅 Your Schedule:\n'];

  withDeadline.forEach(t => {
    const date = new Date(t.deadlineAt!);
    const isToday = date.toDateString() === new Date().toDateString();
    const isOverdue = t.deadlineAt! < now;
    const label = isOverdue ? '🚨 OVERDUE' : isToday ? '🔵 TODAY' : `📌 ${date.toLocaleDateString()}`;
    lines.push(`  ${label}: ${t.title} [${t.status}]`);
  });

  return lines.join('\n');
}

function formatHabits(state: any): string {
  const { habitProfile, executionProfile } = state;
  const lines: string[] = ['🧠 Your Habit Profile:\n'];

  lines.push(`Focus Window: ${habitProfile.focusWindow}`);
  lines.push(`Delay Risk: ${habitProfile.delayRisk}`);
  lines.push(`Preferred Session: ${habitProfile.preferredSession}`);
  lines.push(`Active Hours: ${habitProfile.activeHours}`);

  if (executionProfile) {
    lines.push(`\n📊 Execution Stats:`);
    lines.push(`Completion Rate: ${executionProfile.completionRatePercent}%`);
    lines.push(`Planning Accuracy: ${executionProfile.planningAccuracyPercent}%`);
    lines.push(`Preferred Working Hours: ${executionProfile.preferredWorkingHours}`);
    lines.push(`Most Productive Day: ${executionProfile.mostProductiveWeekday}`);
  }

  return lines.join('\n');
}

function formatMomentum(state: any): string {
  const { metrics, recoveryState, tasks } = state;
  const completed = tasks.filter((t: Task) => t.status === 'Completed').length;
  const total = tasks.length;

  const lines: string[] = [
    `⚡ Momentum: ${metrics.momentumScore}/100\n`,
    `Recovery Status: ${recoveryState.status}`,
    `Mission Confidence: ${recoveryState.missionConfidencePercent}%`,
    `Tasks Today: ${completed}/${total} completed`,
    `Queries Today: ${metrics.queriesToday}`,
  ];

  if (recoveryState.status !== 'Healthy') {
    lines.push(`\n⚠️ ${recoveryState.tasksDeferredCount} task(s) deferred`);
    lines.push(`Estimated recovery: ${recoveryState.estimatedRecoveryHours}h`);
  }

  return lines.join('\n');
}
