import React, { useState, useEffect } from 'react';
import { AppState, Goal, Task, Project } from '../../types';
import {
  Plus,
  FolderKanban,
  Check,
  Square,
  CalendarClock,
  CheckCheck,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Calendar,
  Clock,
  Target,
  Trash2,
  Archive,
  ListTodo,
  Flame,
  ChevronRight,
  ArrowRight,
  X,
} from 'lucide-react';
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
  const day =
    diffDays === 0
      ? 'Today'
      : diffDays === 1
      ? 'Tomorrow'
      : diffDays === -1
      ? 'Yesterday'
      : when.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
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

export function PlanPanel({
  state,
  setState,
  generateId,
}: {
  state: AppState;
  setState: any;
  generateId: any;
}) {
  const rawActiveState = state.viewingSessionId
    ? state.pastSessions?.find((s) => s.id === state.viewingSessionId) || state
    : state;
  const activeState = {
    ...state,
    ...rawActiveState,
    goals: Array.isArray(rawActiveState.goals) ? rawActiveState.goals : [],
    projects: Array.isArray(rawActiveState.projects) ? rawActiveState.projects : [],
    tasks: Array.isArray(rawActiveState.tasks) ? rawActiveState.tasks : [],
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
      ? prev.goals.map((goal) =>
          goal.id === goalId
            ? {
                ...goal,
                title: broken.title,
                description: goal.description || source,
                deadlineAt: broken.deadlineAt || goal.deadlineAt,
              }
            : goal
        )
      : [
          ...prev.goals,
          {
            id: goalId,
            title: broken.title,
            description: source,
            progress: 0,
            createdAt,
            deadlineAt: broken.deadlineAt,
            status: 'Active' as const,
          },
        ];
    return {
      ...prev,
      goals,
      projects: [
        ...prev.projects,
        {
          id: projectId,
          goalId,
          title: broken.title,
          description: '',
          progress: 0,
          createdAt,
          status: 'Active' as const,
        },
      ],
      tasks: [
        ...prev.tasks,
        ...broken.steps.map((step, index) => ({
          id: generateId(),
          projectId,
          title: step.title,
          status: 'Planned' as const,
          createdAt: createdAt + index,
          deadlineAt: step.deadlineAt,
          priority: 'Normal' as const,
        })),
      ],
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

  const emptyGoalIds = isHistoryView
    ? ''
    : activeState.goals
        .filter(
          (goal) =>
            goal.status !== 'Completed' &&
            goal.status !== 'Archived' &&
            (goal.progress || 0) < 100 &&
            !activeState.projects.some(
              (project) => project.goalId === goal.id && project.status !== 'Archived'
            )
        )
        .map((goal) => goal.id)
        .join('|');

  useEffect(() => {
    if (!emptyGoalIds || isHistoryView) return undefined;
    const ids = new Set(emptyGoalIds.split('|'));
    setState((prev: AppState) => {
      const waiting = prev.goals.filter(
        (goal) =>
          ids.has(goal.id) &&
          !prev.projects.some(
            (project) => project.goalId === goal.id && project.status !== 'Archived'
          )
      );
      if (!waiting.length) return prev;
      return waiting.reduce(
        (state, goal) => attachPlan(state, goal.description || goal.title, goal.id),
        prev
      );
    });
    return undefined;
  }, [emptyGoalIds, isHistoryView]);

  const addStep = (goalId: string) => {
    if (isHistoryView) return;
    const title = (stepDrafts[goalId] || '').trim();
    if (!title) return;
    setState((prev: AppState) => {
      const existing = prev.projects.find(
        (p) => p.goalId === goalId && p.status !== 'Archived' && p.status !== 'Completed'
      );
      const projectId = existing?.id || generateId();
      const projects = existing
        ? prev.projects
        : [
            ...prev.projects,
            {
              id: projectId,
              goalId,
              title: prev.goals.find((g) => g.id === goalId)?.title || 'Steps',
              description: '',
              progress: 0,
              createdAt: Date.now(),
              status: 'Active' as const,
            },
          ];
      return {
        ...prev,
        projects,
        tasks: [
          ...prev.tasks,
          {
            id: generateId(),
            projectId,
            title,
            status: 'Planned' as const,
            createdAt: Date.now(),
            priority: 'Normal',
          },
        ],
      };
    });
    setStepDrafts((prev) => ({ ...prev, [goalId]: '' }));
  };

  /**
   * Completes a task permanently.
   * Strict Immutability: Once marked Completed, it cannot be reversed.
   */
  const handleTaskCheck = async (taskId: string, currentStatus: string) => {
    if (isHistoryView) return;
    if (currentStatus === 'Completed' || currentStatus === 'Archived') return;
    playSoftBeep();

    setState((prev: AppState) => {
      const tasks = prev.tasks.map((t) =>
        t.id === taskId ? { ...t, status: 'Completed' as const, completedAt: Date.now() } : t
      );

      let nextState = { ...prev, tasks };
      const completedTask = prev.tasks.find((t) => t.id === taskId);
      if (completedTask) {
        nextState = ReflectionService.onTaskCompleted(nextState, completedTask);
      }

      let history = [...(nextState.history || [])];

      const updatedProjects = nextState.projects.map((p) => {
        const pTasks = tasks.filter((t) => t.projectId === p.id);
        const pTotal = pTasks.length;
        const pCompleted = pTasks.filter(
          (t) => t.status === 'Completed' || t.status === 'Archived'
        ).length;
        const progress = pTotal === 0 ? 0 : Math.round((pCompleted / pTotal) * 100);
        if (progress === 100 && p.progress !== 100) {
          const parent = prev.goals.find((g) => g.id === p.goalId);
          const sameName =
            parent && parent.title.trim().toLowerCase() === p.title.trim().toLowerCase();
          if (!sameName) {
            history.push({
              id: `hist_p_${p.id}_${Date.now()}`,
              entityId: p.id,
              entityType: 'Project',
              title: p.title,
              completedAt: Date.now(),
            });
          }
        }
        return {
          ...p,
          progress,
          status: progress === 100 ? ('Completed' as const) : p.status,
          completedAt: progress === 100 && p.progress !== 100 ? Date.now() : p.completedAt,
        };
      });

      const updatedGoals = prev.goals.map((g) => {
        const gProjects = updatedProjects.filter((p) => p.goalId === g.id);
        if (gProjects.length === 0) return g;
        const totalP = gProjects.reduce((acc, p) => acc + p.progress, 0);
        const progress = Math.round(totalP / gProjects.length);
        if (progress === 100 && g.progress !== 100) {
          history.push({
            id: `hist_g_${g.id}_${Date.now()}`,
            entityId: g.id,
            entityType: 'Goal',
            title: g.title,
            completedAt: Date.now(),
          });
        }
        return {
          ...g,
          progress,
          status: progress === 100 ? ('Completed' as const) : g.status,
          completedAt: progress === 100 && g.progress !== 100 ? Date.now() : g.completedAt,
        };
      });

      if (completedTask) {
        history.push({
          id: generateId(),
          entityId: completedTask.id,
          entityType: 'Task',
          title: completedTask.title,
          completedAt: Date.now(),
        });
      }

      return { ...prev, tasks, projects: updatedProjects, goals: updatedGoals, history };
    });
  };

  const handleClearCompletedPlans = () => {
    if (isHistoryView) return;
    setState((prev: AppState) => {
      const updatedGoals = prev.goals.map((g) =>
        g.progress === 100 || g.status === 'Completed' ? { ...g, status: 'Archived' as const } : g
      );
      const updatedProjects = prev.projects.map((p) =>
        p.progress === 100 || p.status === 'Completed' ? { ...p, status: 'Archived' as const } : p
      );
      const updatedTasks = prev.tasks.map((t) =>
        t.status === 'Completed' ? { ...t, status: 'Archived' as const } : t
      );
      return { ...prev, goals: updatedGoals, projects: updatedProjects, tasks: updatedTasks };
    });
  };

  const handleClearProjectDoneTasks = (projectId: string) => {
    if (isHistoryView) return;
    setState((prev: AppState) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.projectId === projectId && t.status === 'Completed'
          ? { ...t, status: 'Archived' as const }
          : t
      ),
    }));
  };

  const handleArchiveHistory = (id: string) => {
    if (isHistoryView) return;
    setState((prev: AppState) => ({
      ...prev,
      history: (prev.history || []).map((h) => (h.id === id ? { ...h, archived: true } : h)),
    }));
  };

  const handleDeleteHistory = (id: string) => {
    if (isHistoryView) return;
    setState((prev: AppState) => ({
      ...prev,
      history: (prev.history || []).filter((h) => h.id !== id),
    }));
  };

  const activeGoals = activeState.goals.filter((g) => g.status !== 'Archived');
  const visibleGoals =
    viewTab === 'active'
      ? activeGoals.filter((g) => g.status !== 'Completed' && (g.progress || 0) < 100)
      : activeGoals.filter((g) => g.status === 'Completed' || (g.progress || 0) === 100);

  const completedGoalsCount = activeGoals.filter(
    (g) => g.status === 'Completed' || (g.progress || 0) === 100
  ).length;
  const completedTasksCount = activeState.tasks.filter((t) => t.status === 'Completed').length;
  const hasCompletedItems = completedGoalsCount > 0 || completedTasksCount > 0;
  const knownProjectIds = new Set((activeState.projects || []).map((p) => p.id));
  const allIncompleteTasks = (activeState.tasks || []).filter(
    (t) => t.status !== 'Completed' && t.status !== 'Archived'
  );
  const looseTasks = allIncompleteTasks.filter((t) => !knownProjectIds.has(t.projectId));

  const bandRank: Record<string, number> = {
    EMERGENCY: 5,
    OVERDUE: 4,
    CRITICAL: 3,
    WARNING: 2,
    WATCH: 1,
    SAFE: 0,
  };
  let urgent: { task: Task; sev: ReturnType<typeof getSeverityAndText> } | null = null;
  for (const task of allIncompleteTasks) {
    if (!task.deadlineAt) continue;
    const remain = task.deadlineAt - now;
    if (remain < 0 && -remain > 5 * 60 * 1000) continue;
    const sev = getSeverityAndText(task, now);
    if ((bandRank[sev.state] || 0) <= 0) continue;
    const sooner =
      urgent &&
      sev.state === urgent.sev.state &&
      task.deadlineAt < (urgent.task.deadlineAt || Infinity);
    if (!urgent || (bandRank[sev.state] || 0) > (bandRank[urgent.sev.state] || 0) || sooner) {
      urgent = { task, sev };
    }
  }
  const urgentHot =
    !!urgent &&
    (urgent.sev.state === 'CRITICAL' ||
      urgent.sev.state === 'EMERGENCY' ||
      urgent.sev.state === 'OVERDUE');
  const urgentWarn = !!urgent && urgent.sev.state === 'WARNING';
  const urgentPct = urgent?.task.deadlineAt ? urgencyPercent(urgent.task.deadlineAt, now) : 0;
  const showUrgencyBar = urgentHot || urgentWarn;

  const rankedGoals = activeGoals
    .filter((g) => g.status !== 'Completed' && (g.progress || 0) < 100)
    .slice()
    .sort((a, b) => {
      const aRisks =
        activeState.risks?.filter((r) => r.status !== 'Mitigated' && r.relatedId === a.id).length ||
        0;
      const bRisks =
        activeState.risks?.filter((r) => r.status !== 'Mitigated' && r.relatedId === b.id).length ||
        0;
      if (aRisks !== bRisks) return bRisks - aRisks;
      if (a.deadlineAt && b.deadlineAt) return a.deadlineAt - b.deadlineAt;
      if (a.deadlineAt) return -1;
      if (b.deadlineAt) return 1;
      return (a.progress || 0) - (b.progress || 0);
    });
  const firstGoal = rankedGoals[0];
  const firstProjectIds = new Set(
    (activeState.projects || [])
      .filter((p) => firstGoal && p.goalId === firstGoal.id && p.status !== 'Archived')
      .map((p) => p.id)
  );
  const firstOpen =
    orderSteps(
      (activeState.tasks || []).filter(
        (t) =>
          firstProjectIds.has(t.projectId) &&
          t.status !== 'Completed' &&
          t.status !== 'Archived'
      )
    )[0] || null;
  const looseNext =
    [...allIncompleteTasks].sort(
      (a, b) => (a.deadlineAt || Infinity) - (b.deadlineAt || Infinity)
    )[0] || null;
  const nextStep = firstOpen || looseNext;
  const activeRisks = activeState.risks?.filter((r) => r.status !== 'Mitigated') || [];
  const recentHistory = (activeState.history || []).filter(
    (h) => !h.archived && now - h.completedAt < 2 * 60 * 60 * 1000
  );

  const archiveGoal = (goalId: string) => {
    setState((prev: AppState) => ({
      ...prev,
      goals: prev.goals.map((g: Goal) => (g.id === goalId ? { ...g, status: 'Archived' } : g)),
    }));
  };

  const deleteGoal = (goalId: string) => {
    setState((prev: AppState) => {
      const projectIds = new Set(
        prev.projects.filter((p: Project) => p.goalId === goalId).map((p: Project) => p.id)
      );
      return {
        ...prev,
        goals: prev.goals.filter((g: Goal) => g.id !== goalId),
        projects: prev.projects.filter((p: Project) => p.goalId !== goalId),
        tasks: prev.tasks.filter((t: Task) => !projectIds.has(t.projectId)),
      };
    });
  };

  // Find parent context for the hero focus card
  const heroTask = urgent?.task || nextStep;
  const heroProject = heroTask ? activeState.projects.find((p) => p.id === heroTask.projectId) : null;
  const heroGoal = heroProject
    ? activeState.goals.find((g) => g.id === heroProject.goalId)
    : heroTask
    ? activeState.goals.find((g) => g.id === heroTask.projectId)
    : null;

  return (
    <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-bg">
      {/* Read-Only Past Session Banner */}
      {isHistoryView && (
        <div className="bg-accent/10 border border-accent/30 p-2.5 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-text-primary">
              Viewing Past Session (Read-Only)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setState((prev: AppState) => ({ ...prev, viewingSessionId: null }))}
            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors cursor-pointer shadow-xs"
          >
            Return to Active
          </button>
        </div>
      )}

      {/* Modern Plan Header & Controls */}
      <div className="flex items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <FolderKanban className="w-4 h-4 text-accent shrink-0" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary">
              Plan
            </h2>
          </div>

          {/* Segmented View Switcher */}
          <div className="flex items-center bg-panel p-0.5 rounded-lg border border-card-border text-[11px]">
            <button
              type="button"
              onClick={() => setViewTab('active')}
              className={`px-2.5 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                viewTab === 'active'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Active ({activeGoals.filter((g) => g.status !== 'Completed' && (g.progress || 0) < 100).length})
            </button>
            {completedGoalsCount > 0 && (
              <button
                type="button"
                onClick={() => setViewTab('archived')}
                className={`px-2.5 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                  viewTab === 'archived'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Done ({completedGoalsCount})
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {hasCompletedItems && !isHistoryView && (
            <button
              type="button"
              onClick={handleClearCompletedPlans}
              className="text-[10px] font-semibold px-2 py-1 bg-panel hover:bg-accent/15 border border-card-border hover:border-accent/40 text-text-secondary hover:text-accent rounded-lg transition-all flex items-center gap-1 shadow-xs cursor-pointer"
              title="Clean up completed plans and tasks to free up space"
            >
              <Sparkles className="w-3 h-3 text-accent" />
              <span>Clear Done</span>
            </button>
          )}

          {!isHistoryView && (
            <button
              type="button"
              onClick={() => setIsAdding(!isAdding)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-xs ${
                isAdding
                  ? 'bg-panel border border-card-border text-text-primary'
                  : 'bg-accent text-white hover:bg-accent-hover'
              }`}
              title="Add New Goal"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Goal</span>
            </button>
          )}
        </div>
      </div>

      {/* Elevated Goal Creation Card */}
      {isAdding && !isHistoryView && (
        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-accent/40 bg-card p-3 space-y-2.5 shadow-lg animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Add Goal or Sprint</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewGoal('');
              }}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-panel-hover transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <input
            autoFocus
            type="text"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            placeholder="e.g. Launch product sprint by Friday, prepare interview questions..."
            className="w-full bg-bg border border-card-border focus:border-accent rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          />

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <p className="text-[10px] text-text-muted leading-tight">
              ✨ FloatGPT automatically detects deadlines and breaks your goal into steps.
            </p>
            <button
              type="submit"
              disabled={!newGoal.trim()}
              className="px-3 py-1.5 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-xs shrink-0 cursor-pointer"
            >
              Create Plan
            </button>
          </div>
        </form>
      )}

      {/* Recovery State Notice */}
      {viewTab === 'active' &&
        !isHistoryView &&
        state.recoveryState?.isRecovering &&
        allIncompleteTasks.length > 0 && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-xs font-semibold text-text-primary">A bit behind schedule</span>
                <ExplainRecoveryPopover state={state} />
              </div>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              You do not have to catch up on everything today. Start with the immediate step in front of you.
            </p>
            <div className="flex gap-4 text-xs text-text-secondary pt-0.5">
              <div className="flex flex-col">
                <span className="text-[10px] text-text-muted">Estimated Catch-up</span>
                <span className="font-semibold text-text-primary">
                  {state.recoveryState.estimatedRecoveryHours}h
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-text-muted">Tasks Rescheduled</span>
                <span className="font-semibold text-text-primary">
                  {state.recoveryState.tasksDeferredCount}
                </span>
              </div>
            </div>
          </div>
        )}

      {/* Executive Hero Focus Anchor ("Now / Up Next") */}
      {viewTab === 'active' && (urgent || nextStep) && (
        <div
          className={`rounded-xl border p-3.5 shadow-sm space-y-2.5 transition-colors ${
            urgentHot
              ? 'border-danger/50 bg-danger/5'
              : urgentWarn
              ? 'border-warning/50 bg-warning/5'
              : 'border-card-border bg-card'
          }`}
        >
          {/* Top Focus Header */}
          <div className="flex items-center justify-between gap-2 border-b border-card-border/60 pb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`flex h-2 w-2 rounded-full ${
                  urgentHot
                    ? 'bg-danger animate-pulse'
                    : urgentWarn
                    ? 'bg-warning animate-pulse'
                    : 'bg-accent'
                }`}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-primary">
                {urgentHot ? 'Urgent Focus' : 'Current Focus'}
              </span>
              {heroGoal && (
                <span className="text-[10px] text-text-muted truncate max-w-[150px]">
                  · {heroGoal.title}
                </span>
              )}
            </div>

            {urgent && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  urgentHot
                    ? 'border-danger/30 bg-danger/10 text-danger'
                    : urgentWarn
                    ? 'border-warning/30 bg-warning/10 text-warning'
                    : 'border-card-border bg-panel text-text-secondary'
                }`}
              >
                {shortDeadlineLabel(urgent.task.deadlineAt || now, now)}
              </span>
            )}
          </div>

          {/* Task Headline */}
          <p className="text-sm font-bold text-text-primary leading-snug">
            {(urgent?.task || nextStep)?.title}
          </p>

          {/* Urgency Progress Bar */}
          {showUrgencyBar && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-text-muted">
                <span>{urgent?.sev.text}</span>
                <span className={urgentHot ? 'text-danger font-semibold' : 'text-warning font-semibold'}>
                  {urgentPct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-bg border border-card-border/40 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${
                    urgentHot ? 'bg-danger' : 'bg-warning'
                  }`}
                  style={{ width: `${urgentPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Sequential Advisory */}
          {nextStep && urgent && nextStep.id !== urgent.task.id && (
            <div className="text-[11px] text-text-secondary flex items-center gap-1.5 bg-bg/50 p-2 rounded-lg border border-card-border/60">
              <ArrowRight className="w-3 h-3 text-accent shrink-0" />
              <span>
                <strong className="text-text-primary">Do this first:</strong> {nextStep.title}
              </span>
            </div>
          )}

          {/* Risk Alert */}
          {activeRisks.length > 0 && (
            <p className="text-[11px] text-text-secondary leading-snug">
              <span className="text-danger font-semibold">Active Risk: </span>
              {activeRisks[0].title}
              {activeRisks.length > 1 ? ` · +${activeRisks.length - 1} more` : ''}
            </p>
          )}

          {/* Action Row */}
          {nextStep && !isHistoryView && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => handleTaskCheck(nextStep.id, nextStep.status)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors shadow-xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Mark Done</span>
              </button>

              <ExplainPopover task={nextStep} state={state} context="Focus" />
            </div>
          )}
        </div>
      )}

      {/* Main Goal List / Empty State */}
      <div className="space-y-3.5">
        {visibleGoals.length === 0 && !isAdding ? (
          <div className="py-8 px-4 border border-dashed border-card-border rounded-xl bg-card/40 text-center space-y-3">
            {viewTab === 'active' && completedGoalsCount > 0 ? (
              <div className="space-y-2">
                <div className="w-11 h-11 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-sm shadow-emerald-500/10">
                  <CheckCheck className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-text-primary tracking-tight">That list is done!</h4>
                  <p className="text-xs text-text-secondary max-w-[260px] mx-auto leading-relaxed">
                    All goals and milestones completed. Start another sprint or review finished work.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Goal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewTab('archived')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-panel hover:bg-panel-hover border border-card-border text-xs font-semibold text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                  >
                    <span>View Done ({completedGoalsCount})</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="w-11 h-11 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center mx-auto text-accent">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text-primary tracking-tight">Nothing on the Plan</h4>
                  <p className="text-xs text-text-secondary mt-0.5 max-w-[280px] mx-auto leading-relaxed">
                    Enter any high-level objective and FloatGPT will decompose it into steps.
                  </p>
                </div>

                {!isHistoryView && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAdding(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Your First Goal</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          visibleGoals.map((goal) => {
            const isCompleted = goal.status === 'Completed' || (goal.progress || 0) === 100;
            const projects = (activeState.projects || []).filter(
              (p) => p.goalId === goal.id && p.status !== 'Archived'
            );
            const projectIds = new Set(projects.map((p) => p.id));
            const mine = (activeState.tasks || []).filter(
              (t) => projectIds.has(t.projectId) && t.status !== 'Archived'
            );
            const doneCount = mine.filter((t) => t.status === 'Completed').length;
            const event = [...mine].reverse().find((step) => step.deadlineAt);
            const when = event ? clockLabel(event.deadlineAt, now) : '';
            const bar = mine.length
              ? Math.round((doneCount / mine.length) * 100)
              : goal.progress || 0;

            return (
              <div
                key={goal.id}
                className={`rounded-xl border border-card-border bg-card p-3.5 shadow-sm space-y-3 transition-colors ${
                  isCompleted ? 'opacity-80' : 'hover:border-card-border/80'
                }`}
              >
                {/* Goal Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Target
                        className={`w-4 h-4 shrink-0 ${
                          isCompleted ? 'text-text-muted' : 'text-accent'
                        }`}
                      />
                      <h3
                        className={`text-xs font-bold leading-snug truncate ${
                          isCompleted ? 'text-text-muted line-through' : 'text-text-primary'
                        }`}
                      >
                        {goal.title}
                      </h3>
                    </div>

                    {when && (
                      <div className="flex items-center gap-1.5 text-[11px] text-text-secondary mt-1 pl-6">
                        <CalendarClock className="w-3 h-3 text-text-muted shrink-0" />
                        <span>{when}</span>
                      </div>
                    )}
                  </div>

                  {/* Progress Badge & Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-card-border bg-panel text-text-secondary">
                      {mine.length ? `${doneCount}/${mine.length} Done` : `${goal.progress || 0}%`}
                    </span>

                    {!isHistoryView && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => archiveGoal(goal.id)}
                          className="p-1 rounded hover:bg-panel border border-card-border text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                          title="Archive goal"
                        >
                          <Archive className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteGoal(goal.id)}
                          className="p-1 rounded hover:bg-danger/10 border border-card-border hover:border-danger/40 text-text-muted hover:text-danger transition-colors cursor-pointer"
                          title="Delete goal"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 rounded-full bg-bg border border-card-border/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{ width: `${bar}%` }}
                  />
                </div>

                {projects.length === 0 && (
                  <p className="text-xs text-text-secondary pl-1">
                    No steps generated yet. Enter your smallest next step below.
                  </p>
                )}

                {/* Stepper Timeline */}
                <div className="space-y-3">
                  {projects.map((project) => {
                    const tasks = (activeState.tasks || []).filter(
                      (t) => t.projectId === project.id && t.status !== 'Archived'
                    );
                    const done = tasks
                      .filter((t) => t.status === 'Completed')
                      .sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
                    const open = orderSteps(tasks.filter((t) => t.status !== 'Completed'));
                    const steps = [...done, ...open];
                    const sameName =
                      projects.length === 1 &&
                      project.title.trim().toLowerCase() === goal.title.trim().toLowerCase();
                    const completedInProject = tasks.filter((t) => t.status === 'Completed').length;

                    return (
                      <div key={project.id} className="space-y-2">
                        {!sameName && (
                          <div className="flex items-center justify-between gap-2 border-b border-card-border/40 pb-1">
                            <span className="text-[11px] font-bold text-text-secondary truncate">
                              {project.title}
                            </span>
                            {!isHistoryView && (
                              <div className="flex items-center gap-1 shrink-0">
                                {completedInProject > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleClearProjectDoneTasks(project.id)}
                                    className="text-[9px] px-1.5 py-0.5 border border-accent/30 rounded bg-accent/10 hover:bg-accent/20 text-accent transition-colors cursor-pointer"
                                  >
                                    Clear Done
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setState((prev: AppState) => ({
                                      ...prev,
                                      projects: prev.projects.map((p: Project) =>
                                        p.id === project.id ? { ...p, status: 'Archived' } : p
                                      ),
                                    }))
                                  }
                                  className="text-[9px] px-1.5 py-0.5 border border-card-border rounded bg-panel text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                                >
                                  Archive
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setState((prev: AppState) => ({
                                      ...prev,
                                      projects: prev.projects.filter(
                                        (p: Project) => p.id !== project.id
                                      ),
                                    }))
                                  }
                                  className="text-[9px] px-1.5 py-0.5 border border-danger/30 rounded bg-danger/5 hover:bg-danger/20 text-danger transition-colors cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Step rows */}
                        <div className="relative pl-6 space-y-2.5">
                          {steps.length > 1 && (
                            <div className="absolute left-[9px] top-3 bottom-3 w-px bg-card-border" />
                          )}

                          {steps.map((step, index) => {
                            const stepDone = step.status === 'Completed';
                            const current = !stepDone && step.id === open[0]?.id;
                            const soon =
                              !stepDone && step.deadlineAt ? getSeverityAndText(step, now) : null;
                            const tight =
                              soon &&
                              (soon.isEmergency || soon.state === 'CRITICAL' || soon.state === 'OVERDUE');
                            const timeText = !step.deadlineAt
                              ? ''
                              : tight
                              ? soon!.text
                              : clockLabel(step.deadlineAt, now);

                            return (
                              <div
                                key={step.id}
                                className={`relative flex items-start gap-2.5 rounded-lg transition-colors ${
                                  current
                                    ? 'border border-accent/30 bg-accent/5 p-2 -ml-2 shadow-xs'
                                    : 'p-0.5'
                                }`}
                              >
                                {/* Step status bubble */}
                                <button
                                  type="button"
                                  disabled={isHistoryView || stepDone}
                                  onClick={() => handleTaskCheck(step.id, step.status)}
                                  className="shrink-0 mt-0.5 disabled:cursor-default"
                                >
                                  <span
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors ${
                                      stepDone
                                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                                        : current
                                        ? 'bg-accent text-white shadow-xs ring-2 ring-accent/20'
                                        : 'border border-card-border text-text-muted bg-card hover:border-accent'
                                    }`}
                                  >
                                    {stepDone ? (
                                      <Check className="w-3 h-3 stroke-[2.5]" />
                                    ) : (
                                      index + 1
                                    )}
                                  </span>
                                </button>

                                {/* Step text and metadata */}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span
                                      className={`text-xs leading-snug break-words ${
                                        stepDone
                                          ? 'text-text-muted line-through'
                                          : current
                                          ? 'font-bold text-text-primary'
                                          : 'text-text-secondary'
                                      }`}
                                    >
                                      {step.title}
                                    </span>

                                    {current && !isHistoryView && (
                                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/25">
                                        Next
                                      </span>
                                    )}
                                  </div>

                                  {timeText && (
                                    <div className="flex items-center gap-1 text-[10px] mt-0.5">
                                      <Clock className="w-2.5 h-2.5 text-text-muted shrink-0" />
                                      <span
                                        className={
                                          tight
                                            ? soon?.isEmergency || soon?.state === 'OVERDUE'
                                              ? 'text-danger font-semibold'
                                              : 'text-warning font-semibold'
                                            : 'text-text-muted'
                                        }
                                      >
                                        {timeText}
                                      </span>
                                    </div>
                                  )}

                                  {current && !isHistoryView && (
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleTaskCheck(step.id, step.status)}
                                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent hover:underline cursor-pointer"
                                      >
                                        <Check className="w-3 h-3 stroke-[2.5]" />
                                        <span>Mark Done</span>
                                      </button>
                                      <ExplainPopover task={step} state={state} context="Focus" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Inline Quick Add Step Form */}
                {!isHistoryView && !isCompleted && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addStep(goal.id);
                    }}
                    className="flex items-center gap-2 pt-2 border-t border-card-border/50"
                  >
                    <div className="relative flex-1">
                      <Plus className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={stepDrafts[goal.id] || ''}
                        onChange={(e) =>
                          setStepDrafts((prev) => ({ ...prev, [goal.id]: e.target.value }))
                        }
                        placeholder="Add next step..."
                        className="w-full bg-bg-secondary border border-card-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent placeholder:text-text-muted/60"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!stepDrafts[goal.id]?.trim()}
                      className="px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors shrink-0 shadow-xs cursor-pointer"
                    >
                      Add
                    </button>
                  </form>
                )}
              </div>
            );
          })
        )}

        {/* Loose / Standalone Tasks Checklist */}
        {looseTasks.length > 0 && viewTab === 'active' && (
          <div className="space-y-2 pt-1">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <ListTodo className="w-3.5 h-3.5 text-accent" />
              <span>Standalone Tasks ({looseTasks.length})</span>
            </h3>

            <div className="bg-card border border-card-border rounded-xl overflow-hidden divide-y divide-card-border">
              {looseTasks.map((task) => {
                const soon = task.deadlineAt ? getSeverityAndText(task, now) : null;
                const tight =
                  soon &&
                  (soon.isEmergency || soon.state === 'CRITICAL' || soon.state === 'OVERDUE');

                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handleTaskCheck(task.id, task.status)}
                    disabled={isHistoryView}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-panel transition-colors group cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 text-text-muted group-hover:text-accent shrink-0 transition-colors" />
                    <span className="flex-1 min-w-0 text-xs text-text-primary truncate">
                      {task.title}
                    </span>
                    {task.deadlineAt && (
                      <span
                        className={`text-[10px] shrink-0 font-medium ${
                          tight ? 'text-danger font-semibold' : 'text-text-muted'
                        }`}
                      >
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

      {/* Personalized AI Nudge */}
      {viewTab === 'active' &&
        state.settings?.features?.personalizedRecommendations !== false &&
        activeState.recommendations &&
        activeState.recommendations.length > 0 &&
        (allIncompleteTasks.length > 0 || activeGoals.length > 0) && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-accent" />
                <span>AI Recommendation</span>
              </h3>
              <ExplainRecPopover
                recommendation={
                  activeState.recommendations[activeState.recommendations.length - 1]
                }
                state={state}
              />
            </div>
            <div className="p-3 bg-panel border border-card-border rounded-xl">
              <span className="text-xs font-medium text-text-primary leading-relaxed">
                {activeState.recommendations[activeState.recommendations.length - 1].message}
              </span>
            </div>
          </div>
        )}

      {/* Finished in the Last 2 Hours Velocity Ticker */}
      {viewTab === 'active' && recentHistory.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-card-border">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Completed Recently ({recentHistory.length})</span>
          </h3>

          <div className="space-y-1.5">
            {recentHistory
              .slice()
              .reverse()
              .slice(0, 5)
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 p-2 bg-panel border border-card-border rounded-lg"
                >
                  <span className="text-xs text-text-muted line-through truncate flex-1 min-w-0">
                    {item.title}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-text-secondary font-mono">
                      {new Date(item.completedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {!isHistoryView && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleArchiveHistory(item.id)}
                          className="p-1 hover:bg-card rounded text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                          title="Archive"
                        >
                          <Archive className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteHistory(item.id)}
                          className="p-1 hover:bg-danger/10 rounded text-text-muted hover:text-danger transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
