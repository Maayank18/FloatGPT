import React from 'react';
import { Target, CheckCircle2, Focus, Play, Pause, SkipForward } from 'lucide-react';
import { AppState, Task, Goal, Project } from '../../types';
import { getSeverityAndText, SeverityState, getGlobalSortedTasks } from '../../lib/time';
import { useState, useEffect } from 'react';
import { ReflectionService } from '../../lib/reflection';
import { ExplainPopover } from './ExplainPopover';

function PomodoroTimer({ workMins, breakMins }: { workMins: number, breakMins: number }) {
  const [mode, setMode] = useState<'WORK' | 'BREAK'>('WORK');
  const [timeLeft, setTimeLeft] = useState(workMins * 60);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    } else if (isActive && timeLeft === 0) {
      // Auto switch
      const nextMode = mode === 'WORK' ? 'BREAK' : 'WORK';
      setMode(nextMode);
      setTimeLeft(nextMode === 'WORK' ? workMins * 60 : breakMins * 60);
      setIsActive(false); // require manual start for next phase
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, mode, workMins, breakMins]);

  useEffect(() => {
    // Reset if settings change while inactive
    if (!isActive) {
      setTimeLeft(mode === 'WORK' ? workMins * 60 : breakMins * 60);
    }
  }, [workMins, breakMins, mode, isActive]);

  const toggle = () => setIsActive(!isActive);
  const skip = () => {
    const nextMode = mode === 'WORK' ? 'BREAK' : 'WORK';
    setMode(nextMode);
    setTimeLeft(nextMode === 'WORK' ? workMins * 60 : breakMins * 60);
    setIsActive(false);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  
  const totalSeconds = mode === 'WORK' ? workMins * 60 : breakMins * 60;
  const progress = totalSeconds > 0 ? ((totalSeconds - timeLeft) / totalSeconds) * 100 : 0;
  
  const isBreak = mode === 'BREAK';

  return (
    <div className="flex flex-col items-center mb-10">
      <div className="relative w-32 h-32 mb-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" className="fill-none stroke-card-border" strokeWidth="4" />
          <circle 
            cx="50" cy="50" r="45" 
            className={`fill-none transition-all duration-1000 ${isBreak ? 'stroke-success' : 'stroke-accent'}`} 
            strokeWidth="4"
            strokeDasharray="283"
            strokeDashoffset={283 - (283 * progress) / 100}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-mono text-text-primary tracking-tight">
            {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isBreak ? 'text-success' : 'text-accent'}`}>
            {mode}
          </span>
        </div>
      </div>
      
      <div className="flex gap-4">
        <button 
          onClick={toggle}
          className={`w-12 h-12 flex items-center justify-center rounded-full shadow-lg transition-all ${
            isActive 
              ? 'bg-panel border border-card-border text-text-primary hover:bg-panel-hover' 
              : 'bg-accent text-white hover:bg-accent-hover hover:scale-105 shadow-[0_0_15px_var(--color-accent-glow)]'
          }`}
        >
          {isActive ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
        </button>
        <button 
          onClick={skip}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-panel border border-card-border text-text-muted hover:text-text-primary hover:bg-panel-hover transition-all"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
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
        
        <PomodoroTimer 
          workMins={state.settings.productivity?.pomodoroWorkMins || 25} 
          breakMins={state.settings.productivity?.pomodoroBreakMins || 5} 
        />
        
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
