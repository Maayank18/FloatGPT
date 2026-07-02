import { Task, Goal, Project } from '../types';

export type SeverityState = 'SAFE' | 'WATCH' | 'WARNING' | 'CRITICAL' | 'EMERGENCY' | 'OVERDUE' | 'COMPLETED' | 'ARCHIVED';

export function getSeverityAndText(item: Task | Goal | Project, now: number): { state: SeverityState, text: string, isEmergency: boolean } {
  if (item.status === 'Completed') return { state: 'COMPLETED', text: 'Completed', isEmergency: false };
  if (item.status === 'Archived') return { state: 'ARCHIVED', text: 'Archived', isEmergency: false };

  if (!item.deadlineAt) return { state: 'SAFE', text: 'No Deadline', isEmergency: false };

  const timeMs = item.deadlineAt - now;
  const isOverdue = timeMs < 0;
  const absMs = Math.abs(timeMs);
  
  const d = Math.floor(absMs / (1000 * 60 * 60 * 24));
  const h = Math.floor((absMs / (1000 * 60 * 60)) % 24);
  const m = Math.floor((absMs / (1000 * 60)) % 60);
  const s = Math.floor((absMs / 1000) % 60);

  let state: SeverityState = 'SAFE';
  let isEmergency = false;

  if (isOverdue) {
    if (absMs <= 10 * 60 * 1000) {
      state = 'EMERGENCY';
      isEmergency = true;
    } else {
      state = 'OVERDUE';
      isEmergency = false;
    }
  } else {
    const hoursRemaining = timeMs / (1000 * 60 * 60);
    const minutesRemaining = timeMs / (1000 * 60);
    
    if (minutesRemaining <= 10) {
      state = 'EMERGENCY';
      isEmergency = true;
    } else if (minutesRemaining <= 30) {
      state = 'CRITICAL';
    } else if (hoursRemaining <= 1) {
      state = 'WARNING';
    } else if (hoursRemaining <= 24) {
      state = 'WATCH';
    }
  }

  let text = '';
  if (isOverdue) {
    if (d > 0) text = `Overdue by ${d}d ${h}h`;
    else if (h > 0) text = `Overdue by ${h}h ${m}m`;
    else if (m > 0) text = `Overdue by ${m}m ${s}s`;
    else text = `Overdue by ${s}s`;
  } else {
    if (d > 0) text = `${d}d ${h}h remaining`;
    else if (h > 0) text = `${h}h ${m}m remaining`;
    else if (m > 0) text = `${m}m ${s}s remaining`;
    else text = `${s}s remaining`;
  }

  return { state, text, isEmergency };
}

export function getPriorityScore(p?: string) {
  if (!p) return 0;
  const lp = p.toLowerCase();
  if (lp.includes('urgent') || lp.includes('critical') || lp.includes('highest')) return 4;
  if (lp.includes('high')) return 3;
  if (lp.includes('medium') || lp.includes('normal')) return 2;
  if (lp.includes('low')) return 1;
  return 0;
}

export function isTaskReady(taskId: string, allTasks: Task[]) {
  const task = allTasks.find(t => t.id === taskId);
  if (!task?.dependencies || task.dependencies.length === 0) return true;
  return task.dependencies.every(depId => {
    const dep = allTasks.find(t => t.id === depId);
    return !dep || dep.status === 'Completed' || dep.status === 'Archived';
  });
}

export function getGlobalSortedTasks(tasks: Task[], now: number) {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  
  return tasks.slice().sort((a, b) => {
    const aOverdue = a.deadlineAt && a.deadlineAt < now ? 1 : 0;
    const bOverdue = b.deadlineAt && b.deadlineAt < now ? 1 : 0;
    if (aOverdue !== bOverdue) return bOverdue - aOverdue;

    const aTimeRemaining = a.deadlineAt ? a.deadlineAt - now : Infinity;
    const bTimeRemaining = b.deadlineAt ? b.deadlineAt - now : Infinity;
    const aCritical = aTimeRemaining < ONE_DAY ? 1 : 0;
    const bCritical = bTimeRemaining < ONE_DAY ? 1 : 0;
    
    if (aCritical && bCritical) return aTimeRemaining - bTimeRemaining;
    if (aCritical !== bCritical) return bCritical - aCritical;
    
    const aReady = isTaskReady(a.id, tasks) ? 1 : 0;
    const bReady = isTaskReady(b.id, tasks) ? 1 : 0;
    if (aReady !== bReady) return bReady - aReady;
    
    const aPri = getPriorityScore(a.priority);
    const bPri = getPriorityScore(b.priority);
    if (aPri !== bPri) return bPri - aPri;
    
    if (a.deadlineAt && b.deadlineAt) return a.deadlineAt - b.deadlineAt;
    if (a.deadlineAt) return -1;
    if (b.deadlineAt) return 1;
    
    return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
  });
}
