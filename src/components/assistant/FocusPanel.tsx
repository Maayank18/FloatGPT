import React from 'react';
import { Target, CheckCircle2, Focus } from 'lucide-react';
import { AppState, Task, Goal, Project } from '../../types';
import { getSeverityAndText, SeverityState, getGlobalSortedTasks } from '../../lib/time';
import { useState, useEffect } from 'react';
import { ReflectionService } from '../../lib/reflection';
import { ExplainPopover } from './ExplainPopover';

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

const FocusTaskCard: React.FC<{ task: Task, state: AppState, idx: number, onComplete: (id: string) => void | Promise<void> }> = ({ task, state, idx, onComplete }) => {
  const countdown = useLiveSeverity(task);
  const isEmergencyTheme = countdown.state === 'EMERGENCY' || countdown.state === 'OVERDUE';
  const isCritical = countdown.state === 'CRITICAL';

  return (
    <div 
      className={`relative p-4 rounded-xl border transition-all ${
        idx === 0 
          ? 'bg-card border-accent/30 shadow-[0_0_15px_var(--color-accent-glow)]' 
          : 'bg-panel border-card-border opacity-60'
      }`}
    >
      <div className="absolute top-2 right-2">
        <ExplainPopover task={task} state={state} context="Focus" />
      </div>
      <div className="flex items-start justify-between gap-4 pr-12">
        <div className="flex-1">
          <p className={`text-sm font-medium ${idx === 0 ? 'text-text-primary' : 'text-text-muted'}`}>
            {task.title}
          </p>
          {idx === 0 && (task.deadlineAt || task.estimatedEffort || task.carriedOver) && (
            <div className="flex flex-wrap gap-2 mt-2">
              {task.estimatedEffort && <span className="text-[9px] bg-card-border text-text-secondary px-1.5 py-0.5 rounded uppercase tracking-wider">{task.estimatedEffort}</span>}
              {task.deadlineAt && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-medium font-mono tracking-wider ${isEmergencyTheme ? 'bg-danger/20 text-danger' : isCritical ? 'bg-warning/20 text-warning' : 'bg-accent/10 text-accent'}`}>
                  {countdown.text}
                </span>
              )}
              {task.carriedOver && (
                <span className="text-[9px] bg-warning/20 text-warning px-1.5 py-0.5 rounded uppercase tracking-wider">Carried over</span>
              )}
              {task.recovered && (
                <span className="text-[9px] bg-warning/20 text-warning px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Recovered</span>
              )}
            </div>
          )}
        </div>
        {idx === 0 && (
          <button 
            onClick={() => onComplete(task.id)}
            className="w-8 h-8 rounded-full bg-accent/10 hover:bg-accent border border-accent/30 hover:border-accent flex items-center justify-center text-accent hover:text-white transition-all shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function FocusPanel({ state, setState }: { state: AppState, setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const { topTaskIds, coachingMessage } = state.focusModeState;
  
  const activeTasks = state.tasks.filter(t => t.status === 'Active' || t.status === 'In Progress' || t.status === 'Planned');
  const now = Date.now();
  
  let tasksToDisplay = activeTasks.filter(t => topTaskIds?.includes(t.id));
  
  if (tasksToDisplay.length === 0 && activeTasks.length > 0) {
    tasksToDisplay = getGlobalSortedTasks(activeTasks, now).slice(0, 3);
  }

  const handleTaskComplete = async (taskId: string) => {
    // Optimistic update
    setState(prev => {
      const tasks = (prev.tasks || []).map(t => t.id === taskId ? { ...t, status: 'Completed' as const, completedAt: Date.now() } : t);
      
      let nextState = { ...prev, tasks };
      const completedTask = (prev.tasks || []).find(t => t.id === taskId);
      if (completedTask) {
        nextState = ReflectionService.onTaskCompleted(nextState, completedTask);
      }

      const updatedProjects = (nextState.projects || []).map(p => {
        const pTasks = tasks.filter(t => t.projectId === p.id);
        const pTotal = pTasks.length;
        const pCompleted = pTasks.filter(t => t.status === 'Completed' || t.status === 'Archived').length;
        return { ...p, progress: pTotal === 0 ? 0 : Math.round((pCompleted / pTotal) * 100) };
      });

      const updatedGoals = (nextState.goals || []).map(g => {
        const gProjects = updatedProjects.filter(p => p.goalId === g.id);
        if (gProjects.length === 0) return g;
        const totalP = gProjects.reduce((acc, p) => acc + p.progress, 0);
        return { ...g, progress: Math.round(totalP / gProjects.length) };
      });

      return { ...nextState, projects: updatedProjects, goals: updatedGoals };
    });
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-bg relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-50" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-accent-glow)_0%,transparent_70%)]" />

      <div className="z-10 w-full max-w-sm flex flex-col items-center">
        <Focus className="w-10 h-10 text-accent mb-6 opacity-80" />
        
        {coachingMessage && (
          <div className="mb-10 text-center space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-text-muted">Coaching Note</h2>
            <p className="text-sm text-text-primary leading-relaxed italic border-l-2 border-accent/50 pl-4 py-1">
              "{coachingMessage}"
            </p>
          </div>
        )}

        <div className="w-full space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-accent text-center mb-4">
            Critical Path
          </h3>
          
          {tasksToDisplay.length === 0 ? (
            <p className="text-center text-text-secondary text-xs italic">No active tasks found. Go to Plan to start.</p>
          ) : (
            <div className="space-y-3">
              {tasksToDisplay.map((task, idx) => (
                <FocusTaskCard key={task.id} task={task} state={state} idx={idx} onComplete={handleTaskComplete} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
