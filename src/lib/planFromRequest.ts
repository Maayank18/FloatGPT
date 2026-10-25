import type { Goal, Project, Task } from '../types';

export type PlanStep = {
  title: string;
  deadlineAt?: number;
};

export type PlanDraft = {
  title: string;
  deadlineAt?: number;
  message: string;
  steps: PlanStep[];
};

function coreTitle(title: string): string {
  return title.toLowerCase().replace(/,?\s*remotely\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function detailOnly(text: string): boolean {
  const rest = text
    .replace(/\b(tomorrow|today|tonight|remotely|remote|online|please|at)\b/gi, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, '')
    .replace(/[^a-z0-9]+/gi, '');
  return rest.length < 3;
}

function prettyName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function titleFrom(text: string, remote: boolean): string {
  const meeting = text.match(/\bmeeting\s+with\s+([a-z0-9][a-z0-9 .'-]{1,60})/i);
  let title = '';
  if (meeting) {
    const name = meeting[1].replace(/\b(tomorrow|today|tonight|remotely|remote|please|plan)\b.*$/i, '').trim();
    title = name ? `Meeting with ${prettyName(name)}` : 'Meeting';
  } else {
    let cleaned = text
      .replace(/\b(please|can you|could you|i have|i've got|plan it|plan this|plan that)\b/gi, ' ')
      .replace(/\b(tomorrow|today|tonight|remotely|remote)\b/gi, ' ')
      .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    title = cleaned ? prettyName(cleaned) : '';
  }
  if (!title) return '';
  if (remote && !/remotely/i.test(title)) title = `${title}, remotely`;
  return title;
}

function whenFrom(text: string, now: Date): { at?: number; label: string } {
  const clock = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  const tomorrow = /\btomorrow\b/i.test(text);
  const today = /\btoday\b/i.test(text);
  const tonight = /\btonight\b/i.test(text);
  if (!clock && !tomorrow && !today && !tonight) return { label: '' };

  const day = new Date(now);
  if (tomorrow) day.setDate(day.getDate() + 1);
  let hours = 23;
  let minutes = 59;
  if (clock) {
    hours = Number(clock[1]);
    minutes = clock[2] ? Number(clock[2]) : 0;
    const ap = clock[3].toLowerCase();
    if (ap === 'pm' && hours < 12) hours += 12;
    if (ap === 'am' && hours === 12) hours = 0;
  } else if (tonight) {
    hours = 21;
    minutes = 0;
  }
  day.setHours(hours, minutes, 0, 0);

  const timeLabel = day.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dayLabel = tomorrow ? 'tomorrow' : today || tonight ? 'today' : day.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const label = clock || tonight ? `${dayLabel} at ${timeLabel}` : dayLabel;
  return { at: day.getTime(), label };
}

function stepsFor(title: string, text: string, deadlineAt: number | undefined, now: Date): PlanStep[] {
  const meeting = /\bmeeting\b/i.test(text);
  if (!meeting) return [{ title, deadlineAt }];
  const before = (mins: number) => {
    if (!deadlineAt) return undefined;
    const at = deadlineAt - mins * 60 * 1000;
    return at > now.getTime() ? at : undefined;
  };
  return [
    { title: 'Check the time is free', deadlineAt: before(90) },
    { title: 'Write the notes', deadlineAt: before(60) },
    { title: 'Get the brochure or deck ready', deadlineAt: before(30) },
    { title, deadlineAt },
  ];
}

/** The thing they named, plus the real work in front of a meeting. */
export function planFromRequest(userTurns: string[], now = new Date()): PlanDraft | null {
  const turns = userTurns.map((turn) => turn.trim()).filter(Boolean);
  if (!turns.length) return null;
  const latest = turns[turns.length - 1];
  const subject = detailOnly(latest) ? [...turns].reverse().find((turn) => !detailOnly(turn)) || '' : latest;
  if (!subject) return null;
  const combined = `${subject}\n${latest}`;
  const remote = /\bremot/i.test(combined);
  const title = titleFrom(subject, remote);
  if (title.replace(/,?\s*remotely$/i, '').trim().length < 3) return null;
  const when = whenFrom(combined, now);
  const steps = stepsFor(title, combined, when.at, now);
  const message = /\bmeeting\b/i.test(combined)
    ? `${title} is on the plan${when.label ? ` for ${when.label}` : ''}. First check the time, then the notes, then what you will show.`
    : (when.label ? `${title} is on the plan for ${when.label}.` : `${title} is on the plan.`);
  return { title, deadlineAt: when.at, message, steps };
}

export function mergePlanDraft(
  prev: { goals: Goal[]; projects: Project[]; tasks: Task[] },
  draft: PlanDraft,
  ids: { goalId: string; projectId: string; taskIds: string[] }
): { goals: Goal[]; projects: Project[]; tasks: Task[] } {
  const wanted = coreTitle(draft.title);
  const goal = (prev.goals || []).find((item) => {
    const current = coreTitle(item.title);
    return current === wanted || (wanted.length > 8 && (current.includes(wanted) || wanted.includes(current)));
  });
  const now = Date.now();
  const makeTask = (title: string, deadlineAt: number | undefined, id: string, projectId: string): Task => ({
    id, projectId, title, status: 'Planned', createdAt: now, deadlineAt, priority: 'Normal',
  });
  if (!goal) {
    return {
      goals: [...(prev.goals || []), { id: ids.goalId, title: draft.title, description: '', progress: 0, createdAt: now, status: 'Active' }],
      projects: [...(prev.projects || []), { id: ids.projectId, goalId: ids.goalId, title: draft.title, description: '', progress: 0, createdAt: now, status: 'Active' }],
      tasks: [...(prev.tasks || []), ...draft.steps.map((step, index) => makeTask(step.title, step.deadlineAt, ids.taskIds[index] || `${ids.goalId}-${index}`, ids.projectId))],
    };
  }
  const project = (prev.projects || []).find((item) => item.goalId === goal.id && item.status !== 'Archived' && item.status !== 'Completed')
    || (prev.projects || []).find((item) => item.goalId === goal.id);
  const projectId = project?.id || ids.projectId;
  const projects = project
    ? prev.projects
    : [...(prev.projects || []), { id: projectId, goalId: goal.id, title: draft.title, description: '', progress: 0, createdAt: now, status: 'Active' as const }];
  const openTasks = (prev.tasks || []).filter((item) => item.projectId === projectId && item.status !== 'Completed' && item.status !== 'Archived');
  if (openTasks.length === 1 && draft.steps.length > 1 && coreTitle(openTasks[0].title) === wanted) {
    const last = draft.steps[draft.steps.length - 1];
    const kept = (prev.tasks || []).map((item) => item.id === openTasks[0].id ? { ...item, title: last.title, deadlineAt: last.deadlineAt ?? item.deadlineAt } : item);
    const added = draft.steps.slice(0, -1).map((step, index) => makeTask(step.title, step.deadlineAt, ids.taskIds[index] || `${ids.goalId}-${index}`, projectId));
    return {
      goals: prev.goals.map((item) => item.id === goal.id ? { ...item, title: draft.title } : item),
      projects,
      tasks: [...kept, ...added],
    };
  }
  const have = new Set(openTasks.map((item) => item.title.trim().toLowerCase()));
  const added = draft.steps
    .filter((step) => !have.has(step.title.trim().toLowerCase()))
    .map((step, index) => makeTask(step.title, step.deadlineAt, ids.taskIds[index] || `${ids.goalId}-${index}`, projectId));
  const tasks = added.length
    ? [...(prev.tasks || []), ...added]
    : (prev.tasks || []).map((item) => item.projectId === projectId && item.status !== 'Completed' && item.status !== 'Archived'
      ? { ...item, deadlineAt: draft.deadlineAt ?? item.deadlineAt }
      : item);
  return {
    goals: prev.goals.map((item) => item.id === goal.id ? { ...item, title: draft.title } : item),
    projects,
    tasks,
  };
}
