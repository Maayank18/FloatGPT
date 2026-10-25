import React, { useState, useEffect } from 'react';
import { AppState, Task, Goal, Project } from '../../types';
import { Square, AlertTriangle, Lightbulb, Check, CheckCircle2, ShieldAlert, CalendarClock } from 'lucide-react';
import { playSoftBeep } from '../../lib/sound';
import { getSeverityAndText, SeverityState, getGlobalSortedTasks, isTaskReady } from '../../lib/time';
import { ReflectionService } from '../../lib/reflection';
import { ExplainRecPopover } from './ExplainRecPopover';
import { ExplainRecoveryPopover } from './ExplainRecoveryPopover';

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

function useLiveSeverity(item?: Task | Goal | Project) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!item?.deadlineAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [item?.deadlineAt]);

  if (!item) return { text: 'No date', state: 'SAFE' as SeverityState, isEmergency: false };

  return getSeverityAndText(item, now);
}

export function HomePanel({ state, setState, onOpenPlan }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>>, onOpenPlan?: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000); // 10s tick for sorting
    return () => clearInterval(interval);
  }, []);

  const rawActiveState = state.viewingSessionId ? state.pastSessions?.find(s => s.id === state.viewingSessionId) || state : state;
  const activeState = {
    ...state,
    ...rawActiveState,
    goals: Array.isArray(rawActiveState.goals) ? rawActiveState.goals : [],
    projects: Array.isArray(rawActiveState.projects) ? rawActiveState.projects : [],
    tasks: Array.isArray(rawActiveState.tasks) ? rawActiveState.tasks : []
  };
  const isHistoryView = !!state.viewingSessionId;

  const allIncompleteTasks = (activeState.tasks || []).filter(t => t.status !== 'Completed' && t.status !== 'Archived');

  const handleTaskComplete = async (taskId: string) => {
    if (isHistoryView) return;
    playSoftBeep();
    
    // Optimistic UI update
    setState(prev => {
      const tasks = (prev.tasks || []).map(t => t.id === taskId ? { ...t, status: 'Completed' as const, completedAt: Date.now() } : t);
      const completedTaskObj = (prev.tasks || []).find(t => t.id === taskId);
      
      let nextState = { ...prev, tasks };
      if (completedTaskObj) {
        nextState = ReflectionService.onTaskCompleted(nextState, completedTaskObj);
      }
      
      let history = [...(nextState.history || [])];

      // Compute Progress
      const updatedProjects = (nextState.projects || []).map(p => {
        const pTasks = tasks.filter(t => t.projectId === p.id);
        const pTotal = pTasks.length;
        const pCompleted = pTasks.filter(t => t.status === 'Completed' || t.status === 'Archived').length;
        const progress = pTotal === 0 ? 0 : Math.round((pCompleted / pTotal) * 100);
        if (progress === 100 && p.progress !== 100) {
           const parent = (prev.goals || []).find(g => g.id === p.goalId);
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

      const updatedGoals = (prev.goals || []).map(g => {
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

      const completedTask = tasks.find(t => t.id === taskId);
      if (completedTask) {
         history.push({
          id: `hist_${Date.now()}`,
          entityId: completedTask.id,
          entityType: 'Task',
          title: completedTask.title,
          completedAt: Date.now()
        });
      }

      return { ...prev, tasks, projects: updatedProjects, goals: updatedGoals, history };
    });
  };

  const activeGoals = (activeState.goals || []).filter(g => g.status !== 'Archived' && g.status !== 'Completed' && g.progress < 100);
  const currentGoal = activeGoals.sort((a, b) => {
    const aRisks = activeState.risks?.filter(r => r.status !== 'Mitigated' && r.relatedId === a.id).length || 0;
    const bRisks = activeState.risks?.filter(r => r.status !== 'Mitigated' && r.relatedId === b.id).length || 0;
    if (aRisks !== bRisks) return bRisks - aRisks;
    if (a.deadlineAt && b.deadlineAt) return a.deadlineAt - b.deadlineAt;
    if (a.deadlineAt) return -1;
    if (b.deadlineAt) return 1;
    return a.progress - b.progress;
  })[0] || null;

  const orderSteps = (tasks: Task[]) => tasks.slice().sort((a, b) => {
    if (!a.deadlineAt && b.deadlineAt) return -1;
    if (a.deadlineAt && !b.deadlineAt) return 1;
    return (a.deadlineAt || 0) - (b.deadlineAt || 0);
  });
  const boards = activeGoals.map((goal) => {
    const projectIds = new Set((activeState.projects || []).filter(p => p.goalId === goal.id && p.status !== 'Archived').map(p => p.id));
    const mine = (activeState.tasks || []).filter(t => projectIds.has(t.projectId) && t.status !== 'Archived');
    const done = mine.filter(t => t.status === 'Completed').sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
    const open = orderSteps(mine.filter(t => t.status !== 'Completed'));
    const steps = [...done, ...open];
    const event = [...steps].reverse().find(step => step.deadlineAt);
    return { goal, steps, open, event };
  }).filter(board => board.steps.length > 0);
  const goalSteps = boards[0]?.open || [];

  const ONE_DAY = 24 * 60 * 60 * 1000;

  const getPriorityScore = (p?: string) => {
     if (!p) return 0;
     const lp = p.toLowerCase();
     if (lp.includes('urgent') || lp.includes('critical') || lp.includes('highest')) return 4;
     if (lp.includes('high')) return 3;
     if (lp.includes('medium') || lp.includes('normal')) return 2;
     if (lp.includes('low')) return 1;
     return 0;
  };

  const isReady = (taskId: string) => {
    const task = activeState.tasks?.find(t => t.id === taskId);
    if (!task?.dependencies || task.dependencies.length === 0) return true;
    return task.dependencies.every(depId => {
      const dep = activeState.tasks?.find(t => t.id === depId);
      return !dep || dep.status === 'Completed' || dep.status === 'Archived';
    });
  };

  const getEffortMinutes = (e?: string) => {
     if (!e) return Infinity;
     const le = e.toLowerCase();
     let num = parseInt(le.replace(/[^0-9]/g, '')) || 0;
     if (le.includes('h')) num *= 60;
     if (le.includes('d')) num *= 60 * 24;
     return num || Infinity;
  };

  const sortedTasks = getGlobalSortedTasks(allIncompleteTasks, now);

  const carryOverTasks = sortedTasks.filter(t => t.carriedOver);
  const carryOverFocus = carryOverTasks[0] || null;

  const timeCriticalTasks = sortedTasks.filter(t => !t.carriedOver && t.deadlineAt && (t.deadlineAt - now < ONE_DAY));
  const timeCriticalFocus = timeCriticalTasks[0] || null;

  const nonCriticalTasks = sortedTasks.filter(t => !timeCriticalTasks.includes(t) && !carryOverTasks.includes(t));
  const strategicTasks = nonCriticalTasks.slice().sort((a, b) => {
      const aPri = getPriorityScore(a.priority);
      const bPri = getPriorityScore(b.priority);
      if (aPri !== bPri) return bPri - aPri;
      
      const aReady = isTaskReady(a.id, allIncompleteTasks) ? 1 : 0;
      const bReady = isTaskReady(b.id, allIncompleteTasks) ? 1 : 0;
      if (aReady !== bReady) return bReady - aReady;

      return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
  });
  const strategicFocus = strategicTasks[0] || null;
  
  const shownIds = new Set([timeCriticalFocus?.id, carryOverFocus?.id, strategicFocus?.id].filter(Boolean));

  const queueTasks = allIncompleteTasks.filter(t => !shownIds.has(t.id)).sort((a, b) => {
     const aHasDeadline = a.deadlineAt ? 1 : 0;
     const bHasDeadline = b.deadlineAt ? 1 : 0;
     if (aHasDeadline && bHasDeadline) {
         if (a.deadlineAt! !== b.deadlineAt!) return a.deadlineAt! - b.deadlineAt!;
     } else if (aHasDeadline !== bHasDeadline) {
         return bHasDeadline - aHasDeadline;
     }

     const aReady = isTaskReady(a.id, allIncompleteTasks) ? 1 : 0;
     const bReady = isTaskReady(b.id, allIncompleteTasks) ? 1 : 0;
     if (aReady !== bReady) return bReady - aReady;

     const aPri = getPriorityScore(a.priority);
     const bPri = getPriorityScore(b.priority);
     if (aPri !== bPri) return bPri - aPri;

     const aEffort = getEffortMinutes(a.estimatedEffort);
     const bEffort = getEffortMinutes(b.estimatedEffort);
     if (aEffort !== bEffort) return aEffort - bEffort;

     return (a.updatedAt || a.createdAt) - (b.updatedAt || b.createdAt);
  });
  
  const upNextActions = queueTasks.slice(0, 3);

  const activeRisks = activeState.risks?.filter(r => r.status !== 'Mitigated') || [];
  
  const looseNext = [...allIncompleteTasks].sort((a, b) => (a.deadlineAt || Infinity) - (b.deadlineAt || Infinity))[0] || null;
  const nextStep = goalSteps[0] || looseNext;
  const onThisCard = new Set(boards.flatMap(board => board.steps.map(step => step.id)));
  const otherOpen = allIncompleteTasks.filter(task => !onThisCard.has(task.id)).slice(0, 3);
  const countdown = useLiveSeverity(nextStep || undefined);

  const TWO_HOURS = 2 * 60 * 60 * 1000;
  // Get history from last 2 hours that are not archived
  const recentHistory = (activeState.history || []).filter(h => !h.archived && (Date.now() - h.completedAt < TWO_HOURS));

  const handleArchiveHistory = (id: string) => {
    if (isHistoryView) return;
    setState(prev => ({
      ...prev,
      history: (prev.history || []).map(h => h.id === id ? { ...h, archived: true } : h)
    }));
  };

  const handleDeleteHistory = (id: string) => {
    if (isHistoryView) return;
    setState(prev => ({
      ...prev,
      history: (prev.history || []).filter(h => h.id !== id)
    }));
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      
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

      {!isHistoryView && state.recoveryState?.isRecovering && allIncompleteTasks.length > 0 && (
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

      {boards.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-4">
          <p className="text-sm font-semibold text-text-primary">Break one thing down</p>
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">Plan a meeting or a piece of work. The pieces line up here, in the order you do them.</p>
          <div className="mt-4 relative">
            {['First piece', 'Next piece', 'The thing itself'].map((label, index) => (
              <div key={label} className="relative flex gap-3 pb-3 last:pb-0">
                {index < 2 && <span className="absolute left-[9px] top-5 bottom-0 w-px bg-card-border" />}
                <span className="relative z-10 w-5 h-5 rounded-full border border-dashed border-card-border bg-card shrink-0" />
                <span className="text-xs text-text-muted pt-0.5">{label}</span>
              </div>
            ))}
          </div>
          {onOpenPlan && (
            <button type="button" onClick={onOpenPlan} className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-white">
              Plan it
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {boards.map((board) => {
            const when = board.event ? clockLabel(board.event.deadlineAt, now) : '';
            const doneCount = board.steps.length - board.open.length;
            return (
              <div key={board.goal.id} className="bg-card border border-card-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary leading-snug">{board.goal.title}</p>
                    {when && <p className="text-[11px] text-text-secondary mt-0.5">{when}</p>}
                  </div>
                  <span className="text-[10px] text-text-muted shrink-0 pt-0.5">{doneCount}/{board.steps.length}</span>
                </div>
                <div>
                  {board.steps.map((step, index) => {
                    const done = step.status === 'Completed';
                    const current = !done && step.id === board.open[0]?.id;
                    const soon = !done && step.deadlineAt ? getSeverityAndText(step, now) : null;
                    const tight = soon && (soon.isEmergency || soon.state === 'CRITICAL' || soon.state === 'OVERDUE');
                    const timeText = !step.deadlineAt ? '' : tight ? soon!.text : (current && (countdown.isEmergency || countdown.state === 'CRITICAL') && step.id === nextStep?.id ? countdown.text : clockLabel(step.deadlineAt, now));
                    return (
                      <div key={step.id} className="relative flex gap-3">
                        {index < board.steps.length - 1 && (
                          <span className={`absolute left-[9px] top-5 bottom-0 w-px ${done ? 'bg-accent/40' : 'bg-card-border'}`} />
                        )}
                        <button
                          type="button"
                          disabled={isHistoryView || done}
                          onClick={() => handleTaskComplete(step.id)}
                          className="relative z-10 w-full flex gap-3 text-left pb-3 last:pb-0 disabled:cursor-default"
                        >
                          <span className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-semibold ${done ? 'bg-accent/15 text-accent' : current ? 'bg-accent text-white' : 'border border-card-border text-text-muted bg-card'}`}>
                            {done ? <Check className="w-3 h-3" /> : index + 1}
                          </span>
                          <span className="min-w-0 flex-1 -mt-0.5">
                            <span className={`block text-[13px] leading-snug ${done ? 'text-text-muted line-through' : current ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>{step.title}</span>
                            {timeText && (
                              <span className={`block text-[10px] mt-0.5 ${tight ? 'text-danger' : 'text-text-muted'}`}>{timeText}</span>
                            )}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
                {board.goal.id === currentGoal?.id && activeRisks.length > 0 && (
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-danger">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {activeRisks.length} to watch
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {otherOpen.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Also open</h3>
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            {otherOpen.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => handleTaskComplete(task.id)}
                disabled={isHistoryView}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-card-border last:border-b-0 hover:bg-bg-secondary"
              >
                <Square className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span className="flex-1 min-w-0 text-xs text-text-primary truncate">{task.title}</span>
                {task.deadlineAt && <span className="text-[10px] text-text-muted shrink-0">{clockLabel(task.deadlineAt, now)}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Float Suggests / Recommendation */}
      {state.settings?.features?.personalizedRecommendations !== false && activeState.recommendations && activeState.recommendations.length > 0 && (allIncompleteTasks.length > 0 || activeGoals.length > 0) && (
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

      {/* 5. Recently Completed */}
      {recentHistory.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-card-border">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5"/> Finished in the last two hours
          </h3>
          <div className="space-y-2">
            {recentHistory.slice().reverse().slice(0, 5).map(item => (
              <div key={item.id} className="flex flex-col gap-2 p-2.5 bg-bg-secondary border border-card-border rounded-lg group">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary line-through">{item.title}</span>
                  <span className="text-[10px] text-text-secondary font-mono">
                    {new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleArchiveHistory(item.id)} className="text-[9px] px-2 py-0.5 border border-card-border rounded bg-panel hover:bg-panel-hover text-text-muted hover:text-text-primary transition-colors">Archive</button>
                  <button onClick={() => handleDeleteHistory(item.id)} className="text-[9px] px-2 py-0.5 border border-danger/30 rounded bg-danger/5 hover:bg-danger/20 text-danger transition-colors">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
