import React, { useState, useEffect } from 'react';
import { AppState, Task, Goal, Project } from '../../types';
import { Target, ArrowRight, Square, AlertTriangle, Clock, Lightbulb, CheckCircle2, ShieldAlert, CalendarClock } from 'lucide-react';
import { playSoftBeep } from '../../lib/sound';
import { getSeverityAndText, SeverityState, getGlobalSortedTasks, getPriorityScore, isTaskReady } from '../../lib/time';
import { ReflectionService } from '../../lib/reflection';
import { ExplainPopover } from './ExplainPopover';
import { ExplainRecPopover } from './ExplainRecPopover';
import { ExplainRecoveryPopover } from './ExplainRecoveryPopover';

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

  if (!item) return { text: 'No Deadline', state: 'SAFE' as SeverityState, isEmergency: false };

  return getSeverityAndText(item, now);
}

function TaskCard({ task, state, context, onComplete }: { task: Task, state: AppState, context: 'TimeCritical' | 'Strategic' | 'Queue' | 'Focus', onComplete: (id: string) => void }) {
  const countdown = useLiveSeverity(task);
  const isEmergencyTheme = countdown.state === 'EMERGENCY' || countdown.state === 'OVERDUE';
  const isCritical = countdown.state === 'CRITICAL';
  
  return (
    <div 
      onClick={() => onComplete(task.id)}
      className={`flex flex-col gap-2 p-3.5 border-2 rounded-xl cursor-pointer transition-all group shadow-sm relative ${isEmergencyTheme ? 'bg-danger/10 border-danger/50 hover:border-danger shadow-danger/10' : isCritical ? 'bg-warning/10 border-warning/50 hover:border-warning shadow-warning/10' : 'bg-accent/5 border-accent/30 hover:border-accent/60 shadow-accent/5'}`}
    >
      <div className="absolute top-2 right-2">
        <ExplainPopover task={task} state={state} context={context} />
      </div>
      <div className="flex items-start gap-3">
        <button className={`mt-0.5 opacity-80 group-hover:opacity-100 transition-opacity ${isEmergencyTheme ? 'text-danger' : isCritical ? 'text-warning' : 'text-accent'}`}>
          <Square className="w-5 h-5" />
        </button>
        <div className="flex flex-col pr-8">
          <span className={`text-sm font-semibold transition-colors ${isEmergencyTheme ? 'text-danger' : isCritical ? 'text-warning' : 'text-text-primary group-hover:text-accent'}`}>{task.title}</span>
          <span className="text-xs text-text-secondary mt-1">
            Click to mark as complete and trigger the next step.
          </span>
          {isEmergencyTheme && task.deadlineAt && (
            <div className="mt-2 text-xs font-bold text-danger animate-pulse bg-danger/10 px-2 py-1 rounded inline-block">
              {countdown.state === 'OVERDUE' ? 'OVERDUE: ACTION REQUIRED' : 'URGENT: ACTION REQUIRED IMMEDIATELY'}
            </div>
          )}
        </div>
      </div>
      {(task.deadlineAt || task.priority || task.estimatedEffort || task.carriedOver) && (
        <div className="flex flex-wrap gap-1.5 mt-2 ml-8">
          {task.deadlineAt && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-medium font-mono ${isEmergencyTheme ? 'bg-danger/20 text-danger' : isCritical ? 'bg-warning/20 text-warning' : 'bg-accent/10 text-accent'}`}>
              {countdown.text}
            </span>
          )}
          {task.carriedOver && (
            <span className="text-[9px] bg-warning/20 text-warning px-1.5 py-0.5 rounded uppercase font-medium">
              Carried over from yesterday
            </span>
          )}
          {task.priority && (
            <span className="text-[9px] bg-card-border text-text-muted px-1.5 py-0.5 rounded uppercase font-medium">Pri: {task.priority}</span>
          )}
          {task.estimatedEffort && (
            <span className="text-[9px] bg-card-border text-text-secondary px-1.5 py-0.5 rounded uppercase font-medium">{task.estimatedEffort}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function HomePanel({ state, setState }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000); // 10s tick for sorting
    return () => clearInterval(interval);
  }, []);

  const activeState = state.viewingSessionId ? state.pastSessions?.find(s => s.id === state.viewingSessionId) || state : state;
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
           history.push({
             id: `hist_p_${p.id}_${Date.now()}`,
             entityId: p.id,
             entityType: 'Project',
             title: p.title,
             completedAt: Date.now()
           });
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
  
  // Find the primary item to use for the main countdown. Prioritize items with deadlines.
  let itemsWithDeadlines = [currentGoal, timeCriticalFocus, strategicFocus].filter(i => i && i.deadlineAt);
  if (itemsWithDeadlines.length === 0) {
     const tasksWithDeadline = sortedTasks.filter(t => t.deadlineAt);
     if (tasksWithDeadline.length > 0) itemsWithDeadlines = [tasksWithDeadline[0]];
  }
  const primaryItem = itemsWithDeadlines.length > 0 ? itemsWithDeadlines[0] : (currentGoal || timeCriticalFocus || strategicFocus || undefined);
  const countdown = useLiveSeverity(primaryItem);

  const getGuardianColors = (gState: string) => {
    switch (gState) {
      case 'EMERGENCY': return 'text-danger bg-danger/20 border-danger animate-pulse';
      case 'CRITICAL': return 'text-danger bg-danger/10 border-danger/50';
      case 'WARNING': return 'text-warning bg-warning/10 border-warning/50';
      case 'WATCH': return 'text-warning bg-warning/5 border-warning/30';
      case 'OVERDUE': return 'text-danger bg-danger/10 border-danger/50';
      default: return 'text-accent bg-accent/10 border-accent/30';
    }
  };

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
        <div className="bg-panel border border-card-border p-3 rounded-lg flex items-center justify-center gap-2">
          <CalendarClock className="w-4 h-4 text-accent" />
          <span className="text-xs font-medium text-text-primary">Viewing Past Session (Read-Only)</span>
        </div>
      )}

      {!isHistoryView && state.recoveryState?.isRecovering && (
        <div className="bg-warning/10 border-2 border-warning/50 rounded-xl p-3 flex flex-col gap-2 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-1 h-full bg-warning" />
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-xs font-bold text-warning uppercase tracking-wider">Recovery Active</span>
                <ExplainRecoveryPopover state={state} />
              </div>
              <span className="text-[10px] font-mono text-warning/80">{state.recoveryState.status}</span>
           </div>
           <div className="flex gap-4 text-xs mt-1 text-text-secondary">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-text-muted">Estimated Recovery</span>
                <span className="font-medium text-text-primary">{state.recoveryState.estimatedRecoveryHours} Hours</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-text-muted">Mission Confidence</span>
                <span className="font-medium text-text-primary">{state.recoveryState.missionConfidencePercent}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-text-muted">Tasks Deferred</span>
                <span className="font-medium text-text-primary">{state.recoveryState.tasksDeferredCount}</span>
              </div>
           </div>
        </div>
      )}

      {/* 1. Current Goal Dashboard */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5"/> Active Mission
          </div>
          {primaryItem?.deadlineAt && (
            <div className={`px-2 py-0.5 rounded text-[9px] font-bold border ${getGuardianColors(countdown.state)}`}>
              GUARDIAN: {countdown.state}
            </div>
          )}
        </h3>
        
        {!currentGoal ? (
          <div className="p-4 bg-card border border-card-border rounded-lg text-center space-y-2">
            <Target className="w-8 h-8 text-text-muted mx-auto opacity-50" />
            <p className="text-text-secondary text-xs italic">No active mission. Mention a goal or deadline in Chat to begin.</p>
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="p-4 bg-bg-secondary border-b border-card-border">
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-base font-semibold text-text-primary">{currentGoal.title}</h4>
                <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-1 rounded">{currentGoal.progress}%</span>
              </div>
              <div className="w-full bg-card-border rounded-full h-1.5 mt-3">
                <div className="bg-accent h-1.5 rounded-full transition-all duration-500" style={{ width: `${currentGoal.progress}%` }} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 divide-x divide-card-border">
              <div className="p-3 flex flex-col gap-1 items-center justify-center text-center">
                <Clock className="w-4 h-4 text-text-secondary mb-1" />
                <span className="text-[10px] uppercase tracking-wider text-text-muted">Time Remaining</span>
                <span className={`text-xs font-medium font-mono ${countdown.isEmergency ? 'text-danger animate-pulse font-bold' : 'text-text-primary'}`}>{countdown.text}</span>
              </div>
              <div className={`p-3 flex flex-col gap-1 items-center justify-center text-center ${countdown.isEmergency ? 'bg-danger/5' : countdown.state === 'CRITICAL' ? 'bg-warning/5' : ''}`}>
                <ShieldAlert className={`w-4 h-4 mb-1 ${countdown.isEmergency ? 'text-danger' : countdown.state === 'CRITICAL' ? 'text-warning' : activeRisks.length > 0 ? 'text-danger' : 'text-text-secondary'}`} />
                <span className="text-[10px] uppercase tracking-wider text-text-muted">Risk Status</span>
                <span className={`text-xs font-medium ${countdown.isEmergency ? 'text-danger' : countdown.state === 'CRITICAL' ? 'text-warning' : activeRisks.length > 0 ? 'text-danger' : 'text-text-primary'}`}>
                  {countdown.isEmergency ? 'Critical Time Risk' : countdown.state === 'CRITICAL' ? 'High Time Risk' : activeRisks.length > 0 ? `${activeRisks.length} Identified` : 'Clear'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Time-Critical Now */}
      {timeCriticalFocus && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-danger flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5"/> Time-Critical Now
          </h3>
          <TaskCard task={timeCriticalFocus} state={state} context="TimeCritical" onComplete={handleTaskComplete} />
        </div>
      )}

      {/* 2.5 Carry-Over Tasks */}
      {carryOverFocus && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-warning flex items-center gap-2">
             <CalendarClock className="w-3.5 h-3.5"/> Carry-Over Task
          </h3>
          <TaskCard task={carryOverFocus} state={state} context="Strategic" onComplete={handleTaskComplete} />
        </div>
      )}

      {/* 3. Strategic Priority */}
      {strategicFocus && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-2">
            <Target className="w-3.5 h-3.5"/> Strategic Priority
          </h3>
          <TaskCard task={strategicFocus} state={state} context="Strategic" onComplete={handleTaskComplete} />
        </div>
      )}

      {!timeCriticalFocus && !strategicFocus && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-2">
            <ArrowRight className="w-3.5 h-3.5"/> Current Focus
          </h3>
          <p className="text-text-secondary text-xs italic">No actions pending.</p>
        </div>
      )}

      {/* 4. Today Queue */}
      {upNextActions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-2">
            <Clock className="w-3.5 h-3.5"/> Today Queue
          </h3>
          <div className="space-y-2">
            {upNextActions.map(action => (
              <div key={action.id} className="flex items-start gap-3 p-2.5 bg-bg-secondary border border-card-border rounded-lg opacity-70">
                <Square className="w-4 h-4 text-text-muted mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-text-secondary">{action.title}</span>
                  {action.estimatedEffort && <span className="text-[10px] text-text-muted mt-0.5">{action.estimatedEffort}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Float Suggests / Recommendation */}
      {activeState.recommendations && activeState.recommendations.length > 0 && (allIncompleteTasks.length > 0 || activeGoals.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-2">
              <Lightbulb className="w-3.5 h-3.5"/> Float Suggests
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
            <CheckCircle2 className="w-3.5 h-3.5"/> Recently Completed (2h)
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
