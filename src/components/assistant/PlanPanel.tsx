import React, { useState, useEffect } from 'react';
import { AppState, Goal, Task, Project } from '../../types';
import { Plus, FolderKanban, Check, Square, CalendarClock, CheckCheck, Sparkles, AlertTriangle, Lightbulb, CheckCircle2 } from 'lucide-react';
import { getSeverityAndText, urgencyPercent, shortDeadlineLabel } from '../../lib/time';
import { ReflectionService } from '../../lib/reflection';
import { ExplainPopover } from './ExplainPopover';
import { ExplainRecPopover } from './ExplainRecPopover';
import { ExplainRecoveryPopover } from './ExplainRecoveryPopover';
import { playSoftBeep } from '../../lib/sound';
import { breakDown } from '../../lib/planBreakdown';

function clockLabel(at: number | undefined, nowMs: number): string {
  if (!at) return '';
  const when = new Date(at);
  const startToday = new Date(nowMs);
  startToday.setHours(0, 0, 0, 0);
  const startThat = new Date(at);
  startThat.setHours(0, 0, 0, 0);
  const diffDays = Math.round((startThat.getTime() - startToday.getTime()) / 86400000);
  const day = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : diffDays === -1 ? 'Yesterday' : when.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  if (when.getHours() === 23 && when.getMinutes() === 59) return day;
  return `${day}, ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function orderSteps(tasks: Task[]) {
  return tasks.slice().sort((a, b) => {
    if (!a.deadlineAt && b.deadlineAt) return -1;
    if (a.deadlineAt && !b.deadlineAt) return 1;
    return (a.deadlineAt || 0) - (b.deadlineAt || 0);
  });
}

export function PlanPanel({ state, setState, generateId }: { state: AppState, setState: any, generateId: any }) {
  const rawActiveState = state.viewingSessionId ? state.pastSessions?.find(s => s.id === state.viewingSessionId) || state : state;
  const activeState = {
    ...state,
    ...rawActiveState,
    goals: Array.isArray(rawActiveState.goals) ? rawActiveState.goals : [],
    projects: Array.isArray(rawActiveState.projects) ? rawActiveState.projects : [],
    tasks: Array.isArray(rawActiveState.tasks) ? rawActiveState.tasks : []
  };
  const isHistoryView = !!state.viewingSessionId;

  const [now, setNow] = useState(Date.now());
  const [newGoal, setNewGoal] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [viewTab, setViewTab] = useState<'active' | 'archived'>('active');
  const [stepDrafts, setStepDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const attachPlan = (prev: AppState, source: string, goalId: string) => {
    const broken = breakDown(source);
    const projectId = generateId();
    const createdAt = Date.now();
    const goals = prev.goals.some((goal) => goal.id === goalId)
      ? prev.goals.map((goal) => goal.id === goalId ? {
        ...goal,
        title: broken.title,
        description: goal.description || source,
        deadlineAt: broken.deadlineAt || goal.deadlineAt,
      } : goal)
      : [...prev.goals, {
        id: goalId,
        title: broken.title,
        description: source,
        progress: 0,
        createdAt,
        deadlineAt: broken.deadlineAt,
        status: 'Active' as const,
      }];
    return {
      ...prev,
      goals,
      projects: [...prev.projects, {
        id: projectId,
        goalId,
        title: broken.title,
        description: '',
        progress: 0,
        createdAt,
        status: 'Active' as const,
      }],
      tasks: [...prev.tasks, ...broken.steps.map((step, index) => ({
        id: generateId(),
        projectId,
        title: step.title,
        status: 'Planned' as const,
        createdAt: createdAt + index,
        deadlineAt: step.deadlineAt,
        priority: 'Normal' as const,
      }))],
    };
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const source = newGoal.trim();
    if (!source || isHistoryView) return;
    const newGoalId = generateId();
    setState((prev: AppState) => attachPlan(prev, source, newGoalId));
    setNewGoal('');
    setIsAdding(false);
    setViewTab('active');
  };

  const emptyGoalIds = isHistoryView ? '' : activeState.goals
    .filter((goal) => goal.status !== 'Completed' && goal.status !== 'Archived' && (goal.progress || 0) < 100
      && !activeState.projects.some((project) => project.goalId === goal.id && project.status !== 'Archived'))
    .map((goal) => goal.id)
    .join('|');

  useEffect(() => {
    if (!emptyGoalIds || isHistoryView) return undefined;
    const ids = new Set(emptyGoalIds.split('|'));
    setState((prev: AppState) => {
      const waiting = prev.goals.filter((goal) => ids.has(goal.id)
        && !prev.projects.some((project) => project.goalId === goal.id && project.status !== 'Archived'));
      if (!waiting.length) return prev;
      return waiting.reduce((state, goal) => attachPlan(state, goal.description || goal.title, goal.id), prev);
    });
    return undefined;
  }, [emptyGoalIds, isHistoryView]);

  const addStep = (goalId: string) => {
    if (isHistoryView) return;
    const title = (stepDrafts[goalId] || '').trim();
    if (!title) return;
    setState((prev: AppState) => {
      const existing = prev.projects.find(p => p.goalId === goalId && p.status !== 'Archived' && p.status !== 'Completed');
      const projectId = existing?.id || generateId();
      const projects = existing
        ? prev.projects
        : [...prev.projects, { id: projectId, goalId, title: prev.goals.find(g => g.id === goalId)?.title || 'Steps', description: '', progress: 0, createdAt: Date.now(), status: 'Active' as const }];
      return {
        ...prev,
        projects,
        tasks: [...prev.tasks, { id: generateId(), projectId, title, status: 'Planned' as const, createdAt: Date.now(), priority: 'Normal' }],
      };
    });
    setStepDrafts(prev => ({ ...prev, [goalId]: '' }));
  };

  /**
   * Completes a task permanently.
   * Strict Immutability: Once marked Completed, it cannot be reversed.
   * Progress on the goal and project is unchanged from the previous plan screen,
   * so the deadline cloud on the orb still follows the same tasks.
   */
  const handleTaskCheck = async (taskId: string, currentStatus: string) => {
    if (isHistoryView) return;
    if (currentStatus === 'Completed' || currentStatus === 'Archived') return;
    playSoftBeep();

    setState((prev: AppState) => {
      const tasks = prev.tasks.map(t => t.id === taskId ? { ...t, status: 'Completed' as const, completedAt: Date.now() } : t);

      let nextState = { ...prev, tasks };
      const completedTask = prev.tasks.find(t => t.id === taskId);
      if (completedTask) {
        nextState = ReflectionService.onTaskCompleted(nextState, completedTask);
      }

      let history = [...(nextState.history || [])];

      const updatedProjects = nextState.projects.map(p => {
        const pTasks = tasks.filter(t => t.projectId === p.id);
        const pTotal = pTasks.length;
        const pCompleted = pTasks.filter(t => t.status === 'Completed' || t.status === 'Archived').length;
        const progress = pTotal === 0 ? 0 : Math.round((pCompleted / pTotal) * 100);
        if (progress === 100 && p.progress !== 100) {
           const parent = prev.goals.find(g => g.id === p.goalId);
           const sameName = parent && parent.title.trim().toLowerCase() === p.title.trim().toLowerCase();
           if (!sameName) {
             history.push({
               id: `hist_p_${p.id}_${Date.now()}`,
               entityId: p.id,
               entityType: 'Project',
               title: p.title,
               completedAt: Date.now()
             });
           }
        }
        return {
          ...p,
          progress,
          status: progress === 100 ? 'Completed' as const : p.status,
          completedAt: progress === 100 && p.progress !== 100 ? Date.now() : p.completedAt
        };
      });

      const updatedGoals = prev.goals.map(g => {
        const gProjects = updatedProjects.filter(p => p.goalId === g.id);
        if (gProjects.length === 0) return g;
        const totalP = gProjects.reduce((acc, p) => acc + p.progress, 0);
        const progress = Math.round(totalP / gProjects.length);
        if (progress === 100 && g.progress !== 100) {
           history.push({
             id: `hist_g_${g.id}_${Date.now()}`,
             entityId: g.id,
             entityType: 'Goal',
             title: g.title,
             completedAt: Date.now()
           });
        }
        return {
          ...g,
          progress,
          status: progress === 100 ? 'Completed' as const : g.status,
          completedAt: progress === 100 && g.progress !== 100 ? Date.now() : g.completedAt
        };
      });

      if (completedTask) {
         history.push({
           id: generateId(),
           entityId: completedTask.id,
           entityType: 'Task',
           title: completedTask.title,
           completedAt: Date.now()
         });
      }

      return { ...prev, tasks, projects: updatedProjects, goals: updatedGoals, history };
    });
  };

  const handleClearCompletedPlans = () => {
    if (isHistoryView) return;
    setState((prev: AppState) => {
      const updatedGoals = prev.goals.map(g => (g.progress === 100 || g.status === 'Completed') ? { ...g, status: 'Archived' as const } : g);
      const updatedProjects = prev.projects.map(p => (p.progress === 100 || p.status === 'Completed') ? { ...p, status: 'Archived' as const } : p);
      const updatedTasks = prev.tasks.map(t => t.status === 'Completed' ? { ...t, status: 'Archived' as const } : t);
      return { ...prev, goals: updatedGoals, projects: updatedProjects, tasks: updatedTasks };
    });
  };

  const handleClearProjectDoneTasks = (projectId: string) => {
    if (isHistoryView) return;
    setState((prev: AppState) => ({
      ...prev,
      tasks: prev.tasks.map(t => t.projectId === projectId && t.status === 'Completed' ? { ...t, status: 'Archived' as const } : t)
    }));
  };

  const handleArchiveHistory = (id: string) => {
    if (isHistoryView) return;
    setState((prev: AppState) => ({
      ...prev,
      history: (prev.history || []).map(h => h.id === id ? { ...h, archived: true } : h)
    }));
  };

  const handleDeleteHistory = (id: string) => {
    if (isHistoryView) return;
    setState((prev: AppState) => ({
      ...prev,
      history: (prev.history || []).filter(h => h.id !== id)
    }));
  };

  const activeGoals = activeState.goals.filter(g => g.status !== 'Archived');
  const visibleGoals = viewTab === 'active'
    ? activeGoals.filter(g => g.status !== 'Completed' && (g.progress || 0) < 100)
    : activeGoals.filter(g => g.status === 'Completed' || (g.progress || 0) === 100);

  const completedGoalsCount = activeGoals.filter(g => g.status === 'Completed' || (g.progress || 0) === 100).length;
  const completedTasksCount = activeState.tasks.filter(t => t.status === 'Completed').length;
  const hasCompletedItems = completedGoalsCount > 0 || completedTasksCount > 0;
  const knownProjectIds = new Set((activeState.projects || []).map(p => p.id));
  const allIncompleteTasks = (activeState.tasks || []).filter(t => t.status !== 'Completed' && t.status !== 'Archived');
  const looseTasks = allIncompleteTasks.filter(t => !knownProjectIds.has(t.projectId));

  const bandRank: Record<string, number> = { EMERGENCY: 5, OVERDUE: 4, CRITICAL: 3, WARNING: 2, WATCH: 1, SAFE: 0 };
  let urgent: { task: Task; sev: ReturnType<typeof getSeverityAndText> } | null = null;
  for (const task of allIncompleteTasks) {
    if (!task.deadlineAt) continue;
    const remain = task.deadlineAt - now;
    if (remain < 0 && -remain > 5 * 60 * 1000) continue;
    const sev = getSeverityAndText(task, now);
    if ((bandRank[sev.state] || 0) <= 0) continue;
    const sooner = urgent && sev.state === urgent.sev.state && task.deadlineAt < (urgent.task.deadlineAt || Infinity);
    if (!urgent || (bandRank[sev.state] || 0) > (bandRank[urgent.sev.state] || 0) || sooner) {
      urgent = { task, sev };
    }
  }
  const urgentHot = !!urgent && (urgent.sev.state === 'CRITICAL' || urgent.sev.state === 'EMERGENCY' || urgent.sev.state === 'OVERDUE');
  const urgentWarn = !!urgent && urgent.sev.state === 'WARNING';
  const urgentPct = urgent?.task.deadlineAt ? urgencyPercent(urgent.task.deadlineAt, now) : 0;
  const showUrgencyBar = urgentHot || urgentWarn;

  const rankedGoals = activeGoals.filter(g => g.status !== 'Completed' && (g.progress || 0) < 100).slice().sort((a, b) => {
    const aRisks = activeState.risks?.filter(r => r.status !== 'Mitigated' && r.relatedId === a.id).length || 0;
    const bRisks = activeState.risks?.filter(r => r.status !== 'Mitigated' && r.relatedId === b.id).length || 0;
    if (aRisks !== bRisks) return bRisks - aRisks;
    if (a.deadlineAt && b.deadlineAt) return a.deadlineAt - b.deadlineAt;
    if (a.deadlineAt) return -1;
    if (b.deadlineAt) return 1;
    return (a.progress || 0) - (b.progress || 0);
  });
  const firstGoal = rankedGoals[0];
  const firstProjectIds = new Set((activeState.projects || []).filter(p => firstGoal && p.goalId === firstGoal.id && p.status !== 'Archived').map(p => p.id));
  const firstOpen = orderSteps((activeState.tasks || []).filter(t => firstProjectIds.has(t.projectId) && t.status !== 'Completed' && t.status !== 'Archived'))[0] || null;
  const looseNext = [...allIncompleteTasks].sort((a, b) => (a.deadlineAt || Infinity) - (b.deadlineAt || Infinity))[0] || null;
  const nextStep = firstOpen || looseNext;
  const activeRisks = activeState.risks?.filter(r => r.status !== 'Mitigated') || [];
  const recentHistory = (activeState.history || []).filter(h => !h.archived && (now - h.completedAt < 2 * 60 * 60 * 1000));

  const archiveGoal = (goalId: string) => {
    setState((prev: AppState) => ({ ...prev, goals: prev.goals.map((g: Goal) => g.id === goalId ? { ...g, status: 'Archived' } : g) }));
  };

  const deleteGoal = (goalId: string) => {
    setState((prev: AppState) => {
      const projectIds = new Set(prev.projects.filter((p: Project) => p.goalId === goalId).map((p: Project) => p.id));
      return {
        ...prev,
        goals: prev.goals.filter((g: Goal) => g.id !== goalId),
        projects: prev.projects.filter((p: Project) => p.goalId !== goalId),
        tasks: prev.tasks.filter((t: Task) => !projectIds.has(t.projectId)),
      };
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {isHistoryView && (
        <div className="bg-accent/10 border border-accent/30 p-2.5 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-text-primary">Viewing Past Session (Read-Only)</span>
          </div>
          <button
            onClick={() => setState((prev: AppState) => ({ ...prev, viewingSessionId: null }))}
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-accent text-white rounded-md hover:bg-accent/80 transition-colors cursor-pointer shadow-sm"
          >
            Return to Active
          </button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <FolderKanban className="w-3.5 h-3.5 text-accent" /> Plan
          </h3>
          <div className="flex items-center bg-bg-secondary p-0.5 rounded-lg border border-card-border text-[10px]">
            <button
              onClick={() => setViewTab('active')}
              className={`px-2 py-0.5 rounded font-medium transition-all ${viewTab === 'active' ? 'bg-accent text-white shadow-xs' : 'text-text-muted hover:text-text-primary'}`}
            >
              Active ({activeGoals.filter(g => g.status !== 'Completed' && (g.progress || 0) < 100).length})
            </button>
            {completedGoalsCount > 0 && (
              <button
                onClick={() => setViewTab('archived')}
                className={`px-2 py-0.5 rounded font-medium transition-all ${viewTab === 'archived' ? 'bg-accent text-white shadow-xs' : 'text-text-muted hover:text-text-primary'}`}
              >
                Done ({completedGoalsCount})
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {hasCompletedItems && !isHistoryView && (
            <button
              onClick={handleClearCompletedPlans}
              className="text-[10px] font-medium px-2 py-1 bg-panel hover:bg-accent/15 border border-card-border hover:border-accent/40 text-text-secondary hover:text-accent rounded-md transition-all flex items-center gap-1 shadow-xs cursor-pointer"
              title="Clean up completed plans and tasks to free up space"
            >
              <Sparkles className="w-3 h-3 text-accent" />
              <span>Clear Done</span>
            </button>
          )}
          {!isHistoryView && (
            <button
              onClick={() => setIsAdding(true)}
              className="p-1 hover:bg-panel-hover rounded text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              title="Add New Goal"
            >
              <Plus className="w-4 h-4"/>
            </button>
          )}
        </div>
      </div>

      {isAdding && !isHistoryView && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            autoFocus
            type="text"
            value={newGoal}
            onChange={e => setNewGoal(e.target.value)}
            placeholder="What do you need to get done?"
            className="flex-1 bg-card border border-card-border rounded-md px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
          />
          <button type="submit" className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-md hover:bg-accent-hover cursor-pointer">Add</button>
        </form>
      )}

      {viewTab === 'active' && !isHistoryView && state.recoveryState?.isRecovering && allIncompleteTasks.length > 0 && (
        <div className="bg-warning/10 border border-warning/40 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span className="text-xs font-semibold text-text-primary">A bit behind</span>
              <ExplainRecoveryPopover state={state} />
            </div>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">You do not have to catch all of it today. Start with the one in front of you.</p>
          <div className="flex gap-4 text-xs text-text-secondary">
            <div className="flex flex-col">
              <span className="text-[10px] text-text-muted">Catch-up</span>
              <span className="font-medium text-text-primary">{state.recoveryState.estimatedRecoveryHours}h</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-text-muted">Moved</span>
              <span className="font-medium text-text-primary">{state.recoveryState.tasksDeferredCount}</span>
            </div>
          </div>
        </div>
      )}

      {viewTab === 'active' && (urgent || nextStep) && (
        <div className={`bg-card border rounded-xl p-3.5 ${urgentHot ? 'border-danger/50' : urgentWarn ? 'border-warning/50' : 'border-card-border'}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Now</span>
            {urgent && (
              <span className={`text-[11px] font-semibold ${urgentHot ? 'text-danger' : urgentWarn ? 'text-warning' : 'text-text-secondary'}`}>
                {shortDeadlineLabel(urgent.task.deadlineAt || now, now)}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-text-primary leading-snug mt-1">
            {(urgent?.task || nextStep)?.title}
          </p>
          {showUrgencyBar && (
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
                <span>{urgent?.sev.text}</span>
                <span className={urgentHot ? 'text-danger' : 'text-warning'}>{urgentPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-bg overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${urgentHot ? 'bg-danger' : 'bg-warning'}`}
                  style={{ width: `${urgentPct}%` }}
                />
              </div>
            </div>
          )}
          {nextStep && urgent && nextStep.id !== urgent.task.id && (
            <p className="mt-2 text-[11px] text-text-secondary leading-snug">Do this first: {nextStep.title}</p>
          )}
          {activeRisks.length > 0 && (
            <p className="mt-2 text-[11px] text-text-secondary leading-snug">
              <span className="text-danger font-semibold">Risk. </span>
              {activeRisks[0].title}
              {activeRisks.length > 1 ? ` · ${activeRisks.length - 1} more` : ''}
            </p>
          )}
          {nextStep && !isHistoryView && (
            <button
              type="button"
              onClick={() => handleTaskCheck(nextStep.id, nextStep.status)}
              className="mt-3 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-accent text-white"
            >
              Mark done
            </button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {visibleGoals.length === 0 && !isAdding ? (
          <div className="py-8 px-4 border border-dashed border-card-border rounded-xl bg-bg-secondary text-center">
            {viewTab === 'active' && completedGoalsCount > 0 ? (
              <div className="space-y-1">
                <CheckCheck className="w-6 h-6 text-accent mx-auto mb-2" />
                <p className="text-sm font-medium text-text-primary">That list is done.</p>
                <p className="text-xs text-text-secondary">Start another when you want. One name is enough.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-text-primary">Nothing on the plan.</p>
                <p className="text-xs text-text-secondary leading-relaxed">Name one thing you are willing to start. The rest can wait.</p>
                {!isHistoryView && (
                  <button
                    type="button"
                    onClick={() => setIsAdding(true)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-white"
                  >
                    Name it
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          visibleGoals.map(goal => {
            const isCompleted = goal.status === 'Completed' || (goal.progress || 0) === 100;
            const projects = (activeState.projects || []).filter(p => p.goalId === goal.id && p.status !== 'Archived');
            const projectIds = new Set(projects.map(p => p.id));
            const mine = (activeState.tasks || []).filter(t => projectIds.has(t.projectId) && t.status !== 'Archived');
            const doneCount = mine.filter(t => t.status === 'Completed').length;
            const event = [...mine].reverse().find(step => step.deadlineAt);
            const when = event ? clockLabel(event.deadlineAt, now) : '';
            const bar = mine.length ? Math.round((doneCount / mine.length) * 100) : (goal.progress || 0);

            return (
              <div key={goal.id} className={`bg-card border border-card-border rounded-xl p-4 ${isCompleted ? 'opacity-80' : ''}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold leading-snug ${isCompleted ? 'text-text-muted line-through' : 'text-text-primary'}`}>{goal.title}</p>
                    {when && <p className="text-[11px] text-text-secondary mt-0.5">{when}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-text-muted pt-0.5">{mine.length ? `${doneCount}/${mine.length}` : `${goal.progress || 0}%`}</span>
                    {!isHistoryView && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => archiveGoal(goal.id)}
                          className="text-[9px] px-1.5 py-0.5 border border-card-border rounded bg-panel hover:bg-panel-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                        >
                          Archive
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteGoal(goal.id)}
                          className="text-[9px] px-1.5 py-0.5 border border-card-border rounded bg-panel text-text-muted hover:border-danger/40 hover:text-danger transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-1 rounded-full bg-bg overflow-hidden mb-3">
                  <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${bar}%` }} />
                </div>

                {projects.length === 0 && (
                  <p className="text-xs text-text-secondary mb-3">No steps yet. What is the smallest start?</p>
                )}

                <div className="space-y-3">
                  {projects.map(project => {
                    const tasks = (activeState.tasks || []).filter(t => t.projectId === project.id && t.status !== 'Archived');
                    const done = tasks.filter(t => t.status === 'Completed').sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
                    const open = orderSteps(tasks.filter(t => t.status !== 'Completed'));
                    const steps = [...done, ...open];
                    const sameName = projects.length === 1 && project.title.trim().toLowerCase() === goal.title.trim().toLowerCase();
                    const completedInProject = tasks.filter(t => t.status === 'Completed').length;
                    return (
                      <div key={project.id}>
                        {!sameName && (
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[11px] font-semibold text-text-secondary truncate">{project.title}</span>
                            {!isHistoryView && (
                              <div className="flex items-center gap-1 shrink-0">
                                {completedInProject > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleClearProjectDoneTasks(project.id)}
                                    className="text-[9px] px-1.5 py-0.5 border border-accent/30 rounded bg-accent/10 hover:bg-accent/20 text-accent transition-colors cursor-pointer"
                                  >
                                    Clear done
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setState((prev: AppState) => ({ ...prev, projects: prev.projects.map((p: Project) => p.id === project.id ? { ...p, status: 'Archived' } : p) }))}
                                  className="text-[9px] px-1.5 py-0.5 border border-card-border rounded bg-panel text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                                >
                                  Archive
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setState((prev: AppState) => ({ ...prev, projects: prev.projects.filter((p: Project) => p.id !== project.id) }))}
                                  className="text-[9px] px-1.5 py-0.5 border border-danger/30 rounded bg-danger/5 hover:bg-danger/20 text-danger transition-colors cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {steps.map((step, index) => {
                          const stepDone = step.status === 'Completed';
                          const current = !stepDone && step.id === open[0]?.id;
                          const soon = !stepDone && step.deadlineAt ? getSeverityAndText(step, now) : null;
                          const tight = soon && (soon.isEmergency || soon.state === 'CRITICAL' || soon.state === 'OVERDUE');
                          const timeText = !step.deadlineAt ? '' : tight ? soon!.text : clockLabel(step.deadlineAt, now);
                          return (
                            <div key={step.id} className="relative flex gap-2 pb-3 last:pb-0">
                              {index < steps.length - 1 && (
                                <span className={`absolute left-[9px] top-5 bottom-0 w-px ${stepDone ? 'bg-accent/40' : 'bg-card-border'}`} />
                              )}
                              <button
                                type="button"
                                disabled={isHistoryView || stepDone}
                                onClick={() => handleTaskCheck(step.id, step.status)}
                                className="relative z-10 flex-1 min-w-0 flex gap-3 text-left disabled:cursor-default"
                              >
                                <span className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-semibold ${stepDone ? 'bg-accent/15 text-accent' : current ? 'bg-accent text-white' : 'border border-card-border text-text-muted bg-card'}`}>
                                  {stepDone ? <Check className="w-3 h-3" /> : index + 1}
                                </span>
                                <span className="min-w-0 flex-1 -mt-0.5">
                                  {current && !isHistoryView && <span className="block text-[10px] font-semibold text-accent">Next</span>}
                                  <span className={`block text-[13px] leading-snug ${stepDone ? 'text-text-muted line-through' : current ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>{step.title}</span>
                                  {timeText && (
                                    <span className={`block text-[10px] mt-0.5 ${tight ? (soon?.isEmergency || soon?.state === 'OVERDUE' ? 'text-danger' : 'text-warning') : 'text-text-muted'}`}>{timeText}</span>
                                  )}
                                  {current && !isHistoryView && (
                                    <span className="inline-block mt-1 text-[10px] font-semibold text-accent">Mark done</span>
                                  )}
                                </span>
                              </button>
                              {current && <ExplainPopover task={step} state={state} context="Focus" />}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {!isHistoryView && !isCompleted && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addStep(goal.id);
                    }}
                    className="flex gap-2 mt-1"
                  >
                    <input
                      type="text"
                      value={stepDrafts[goal.id] || ''}
                      onChange={(e) => setStepDrafts(prev => ({ ...prev, [goal.id]: e.target.value }))}
                      placeholder="Smallest next step"
                      className="flex-1 bg-bg-secondary border border-card-border rounded-md px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                    />
                    <button type="submit" className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-md">Add</button>
                  </form>
                )}
              </div>
            );
          })
        )}

        {looseTasks.length > 0 && viewTab === 'active' && (
          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Also open</h3>
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              {looseTasks.map((task) => {
                const soon = task.deadlineAt ? getSeverityAndText(task, now) : null;
                const tight = soon && (soon.isEmergency || soon.state === 'CRITICAL' || soon.state === 'OVERDUE');
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handleTaskCheck(task.id, task.status)}
                    disabled={isHistoryView}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-card-border last:border-b-0 hover:bg-bg-secondary"
                  >
                    <Square className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span className="flex-1 min-w-0 text-xs text-text-primary truncate">{task.title}</span>
                    {task.deadlineAt && (
                      <span className={`text-[10px] shrink-0 ${tight ? 'text-danger' : 'text-text-muted'}`}>
                        {tight ? soon!.text : clockLabel(task.deadlineAt, now)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {viewTab === 'active' && state.settings?.features?.personalizedRecommendations !== false && activeState.recommendations && activeState.recommendations.length > 0 && (allIncompleteTasks.length > 0 || activeGoals.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-2">
              <Lightbulb className="w-3.5 h-3.5"/> A nudge
            </h3>
            <ExplainRecPopover recommendation={activeState.recommendations[activeState.recommendations.length - 1]} state={state} />
          </div>
          <div className="p-3.5 bg-bg-secondary border border-card-border rounded-xl">
            <span className="text-xs font-medium text-text-primary leading-relaxed">
              {activeState.recommendations[activeState.recommendations.length - 1].message}
            </span>
          </div>
        </div>
      )}

      {viewTab === 'active' && recentHistory.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-card-border">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5"/> Finished in the last two hours
          </h3>
          <div className="space-y-2">
            {recentHistory.slice().reverse().slice(0, 5).map(item => (
              <div key={item.id} className="flex items-center justify-between gap-2 p-2.5 bg-bg-secondary border border-card-border rounded-lg">
                <span className="text-xs text-text-secondary line-through truncate">{item.title}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-text-secondary font-mono">
                    {new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {!isHistoryView && (
                    <>
                      <button onClick={() => handleArchiveHistory(item.id)} className="text-[9px] px-2 py-0.5 border border-card-border rounded bg-panel hover:bg-panel-hover text-text-muted hover:text-text-primary transition-colors">Archive</button>
                      <button onClick={() => handleDeleteHistory(item.id)} className="text-[9px] px-2 py-0.5 border border-danger/30 rounded bg-danger/5 hover:bg-danger/20 text-danger transition-colors">Delete</button>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
