import { AppState, Task, Goal } from '../types';

export function generateWorkspaceSummary(state: AppState): string {
  // 1. Gather all incomplete tasks across all projects
  const allTasks = state.tasks || [];
  const incompleteTasks = allTasks.filter(t => t.status === 'Active' || t.status === 'In Progress' || t.status === 'Planned');

  if (incompleteTasks.length === 0) {
    return "You have no remaining tasks. Great job! All active items are completed or archived.";
  }

  // 2. Classify tasks
  const now = Date.now();
  const overdue: Task[] = [];
  const critical: Task[] = [];
  const focus: Task[] = [];
  const strategic: Task[] = [];
  const upNext: Task[] = [];
  const blocked: Task[] = [];

  const activeGoals = (state.goals || []).filter(g => g.status !== 'Archived' && g.status !== 'Completed' && g.progress < 100);
  const currentGoal = activeGoals.sort((a, b) => {
    const aRisks = state.risks?.filter(r => r.status !== 'Mitigated' && r.relatedId === a.id).length || 0;
    const bRisks = state.risks?.filter(r => r.status !== 'Mitigated' && r.relatedId === b.id).length || 0;
    if (aRisks !== bRisks) return bRisks - aRisks;
    if (a.deadlineAt && b.deadlineAt) return a.deadlineAt - b.deadlineAt;
    if (a.deadlineAt) return -1;
    if (b.deadlineAt) return 1;
    return a.progress - b.progress;
  })[0];

  const isReady = (taskId: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task?.dependencies || task.dependencies.length === 0) return true;
    return task.dependencies.every(depId => {
      const dep = allTasks.find(t => t.id === depId);
      return !dep || dep.status === 'Completed' || dep.status === 'Archived';
    });
  };

  for (const t of incompleteTasks) {
    if (!isReady(t.id)) {
      blocked.push(t);
      continue;
    }

    if (t.deadlineAt) {
      const timeMs = t.deadlineAt - now;
      if (timeMs < 0) {
        overdue.push(t);
        continue;
      } else if (timeMs <= 1000 * 60 * 60) {
        critical.push(t);
        continue;
      }
    }

    if (t.priority === 'High' || t.priority === 'Urgent') {
      focus.push(t);
      continue;
    }
    
    // Check if task belongs to current goal
    const project = (state.projects || []).find(p => p.id === t.projectId);
    if (project && currentGoal && project.goalId === currentGoal.id) {
      strategic.push(t);
      continue;
    }

    upNext.push(t);
  }

  // 3. Format Response
  let res = `WORKSPACE SUMMARY\n\n`;
  if (currentGoal) {
    res += `Active Mission: ${currentGoal.title}\n`;
  }
  res += `Total Remaining Tasks: ${incompleteTasks.length}\n\n`;

  if (overdue.length > 0) {
    res += `🚨 OVERDUE\n`;
    overdue.forEach(t => res += `• ${t.title}\n`);
    res += `\n`;
  }

  if (critical.length > 0) {
    res += `⏳ TIME-CRITICAL (< 1 hour)\n`;
    critical.forEach(t => res += `• ${t.title}\n`);
    res += `\n`;
  }

  if (focus.length > 0) {
    res += `🔥 CURRENT FOCUS (High Priority)\n`;
    focus.forEach(t => res += `• ${t.title}\n`);
    res += `\n`;
  }

  if (strategic.length > 0) {
    res += `🎯 STRATEGIC PRIORITY\n`;
    strategic.forEach(t => res += `• ${t.title}\n`);
    res += `\n`;
  }

  if (upNext.length > 0) {
    res += `📝 UP NEXT / TODAY\n`;
    upNext.slice(0, 5).forEach(t => res += `• ${t.title}\n`);
    if (upNext.length > 5) res += `• ...and ${upNext.length - 5} more\n`;
    res += `\n`;
  }

  if (blocked.length > 0) {
    res += `🔒 BLOCKED (Dependencies)\n`;
    blocked.slice(0, 3).forEach(t => res += `• ${t.title}\n`);
    if (blocked.length > 3) res += `• ...and ${blocked.length - 3} more\n`;
  }

  return res.trim();
}
