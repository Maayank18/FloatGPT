import React, { useState, useEffect } from 'react';
import { AppState, Goal, Task, Project } from '../../types';
import { Plus, FolderKanban, ChevronDown, ChevronRight, CheckSquare, Square, CalendarClock } from 'lucide-react';
import { getSeverityAndText, SeverityState, getGlobalSortedTasks } from '../../lib/time';
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

const PlanTaskItem: React.FC<{ task: Task, state: AppState, handleTaskCheck: (id: string, status: string) => void | Promise<void> }> = ({ task, state, handleTaskCheck }) => {
  const isCompleted = task.status === 'Completed' || task.status === 'Archived';
  const countdown = useLiveSeverity(task);
  const isEmergencyTheme = countdown.state === 'EMERGENCY' || countdown.state === 'OVERDUE';
  const isCritical = countdown.state === 'CRITICAL';

  return (
    <div className="flex gap-2 p-1.5 bg-card border border-card-border rounded transition-colors hover:border-accent/30 relative">
      <div className="absolute top-1 right-1">
        <ExplainPopover task={task} state={state} context="Queue" />
      </div>
      <button 
        onClick={() => handleTaskCheck(task.id, task.status)}
        className="mt-0.5 text-text-muted hover:text-accent transition-colors shrink-0"
      >
        {isCompleted ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}
      </button>
      <div className="flex flex-col gap-1 w-full pr-8">
        <div className="flex items-center justify-between">
          <span className={`text-[11px] ${isCompleted ? 'text-text-muted line-through' : 'text-text-primary'}`}>{task.title}</span>
        </div>
        {(!isCompleted && (task.deadlineAt || task.priority || task.estimatedEffort || task.carriedOver)) && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {task.deadlineAt && (
              <span className={`text-[8px] px-1 rounded uppercase tracking-wider ${isEmergencyTheme ? 'bg-danger/20 text-danger' : isCritical ? 'bg-warning/20 text-warning' : 'bg-accent/10 text-accent'}`}>
                {countdown.text}
              </span>
            )}
            {task.carriedOver && (
              <span className="text-[8px] bg-warning/20 text-warning px-1 rounded uppercase tracking-wider">Carried over</span>
            )}
            {task.recovered && (
              <span className="text-[8px] bg-warning/20 text-warning px-1 rounded uppercase tracking-wider font-bold">Recovered</span>
            )}
            {task.deferred && (
              <span className="text-[8px] bg-card-border text-text-secondary px-1 rounded uppercase tracking-wider">Deferred</span>
            )}
            {task.split && (
              <span className="text-[8px] bg-accent/20 text-accent px-1 rounded uppercase tracking-wider">Split</span>
            )}
            {task.priority && (
              <span className="text-[8px] bg-card-border text-text-muted px-1 rounded uppercase">Pri: {task.priority}</span>
            )}
            {task.estimatedEffort && (
              <span className="text-[8px] bg-card-border text-text-secondary px-1 rounded uppercase">{task.estimatedEffort}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function PlanPanel({ state, setState, generateId }: { state: AppState, setState: any, generateId: any }) {
  const activeState = state.viewingSessionId ? state.pastSessions?.find(s => s.id === state.viewingSessionId) || state : state;
  const isHistoryView = !!state.viewingSessionId;

  const [newGoal, setNewGoal] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(activeState.goals[0]?.id || null);

  useEffect(() => {
    // If the currently expanded goal is deleted, reset to the first available or null
    if (expandedGoalId && activeState.goals.length > 0 && !activeState.goals.some(g => g.id === expandedGoalId)) {
      setExpandedGoalId(activeState.goals[0].id);
    } else if (activeState.goals.length === 0) {
      setExpandedGoalId(null);
    }
  }, [activeState.goals, expandedGoalId]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.trim() || isHistoryView) return;
    const newGoalId = generateId();
    setState((prev: AppState) => ({
      ...prev,
      goals: [...prev.goals, { id: newGoalId, title: newGoal, description: '', progress: 0, createdAt: Date.now() }]
    }));
    setExpandedGoalId(newGoalId);
    setNewGoal('');
    setIsAdding(false);
  };

  const handleTaskCheck = async (taskId: string, currentStatus: string) => {
    if (isHistoryView) return;
    const isCompleted = currentStatus === 'Completed';
    const newStatus = isCompleted ? 'Planned' : 'Completed';
    
    // Optimistic update
    setState((prev: AppState) => {
      const tasks = prev.tasks.map(t => t.id === taskId ? { ...t, status: newStatus as any, completedAt: newStatus === 'Completed' ? Date.now() : undefined } : t);
      
      let nextState = { ...prev, tasks };
      if (newStatus === 'Completed') {
        const completedTask = prev.tasks.find(t => t.id === taskId);
        if (completedTask) {
          nextState = ReflectionService.onTaskCompleted(nextState, completedTask);
        }
      }

      let history = [...(nextState.history || [])];

      const updatedProjects = nextState.projects.map(p => {
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

      // Add task to history if completed
      if (newStatus === 'Completed') {
        const task = prev.tasks.find(t => t.id === taskId);
        if (task) {
           history.push({
             id: generateId(),
             entityId: task.id,
             entityType: 'Task',
             title: task.title,
             completedAt: Date.now()
           });
        }
      }

      return { ...prev, tasks, projects: updatedProjects, goals: updatedGoals, history };
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {isHistoryView && (
        <div className="bg-panel border border-card-border p-3 rounded-lg flex items-center justify-center gap-2">
          <CalendarClock className="w-4 h-4 text-accent" />
          <span className="text-xs font-medium text-text-primary">Viewing Past Session (Read-Only)</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-2">
          <FolderKanban className="w-3.5 h-3.5" /> Plan
        </h3>
        {!isHistoryView && (
          <button 
            onClick={() => setIsAdding(true)} 
            className="p-1 hover:bg-panel-hover rounded text-text-secondary hover:text-text-primary transition-colors"
          >
            <Plus className="w-4 h-4"/>
          </button>
        )}
      </div>

      {isAdding && !isHistoryView && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input 
            autoFocus 
            type="text" 
            value={newGoal} 
            onChange={e => setNewGoal(e.target.value)} 
            placeholder="Goal title..." 
            className="flex-1 bg-card border border-card-border rounded-md px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent" 
          />
          <button type="submit" className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-md hover:bg-accent-hover">Add</button>
        </form>
      )}

      <div className="space-y-4">
        {activeState.goals.length === 0 && !isAdding ? (
          <div className="text-center py-8 border border-dashed border-card-border rounded-lg bg-bg-secondary">
            <p className="text-[11px] font-medium text-text-secondary mb-1">No plan active</p>
            <p className="text-[10px] text-text-muted px-4">Just mention a task, deadline, or goal in Chat to start automatically.</p>
          </div>
        ) : (
          activeState.goals.length > 0 && (
            <div className="space-y-3">
              {activeState.goals.filter(g => g.status !== 'Archived').map(goal => {
                const isExpanded = expandedGoalId === goal.id;
                const isCompleted = goal.status === 'Completed' || goal.progress === 100;
                
                return (
                  <div key={goal.id} className={`border border-card-border bg-card rounded-lg overflow-hidden transition-all ${isCompleted ? 'opacity-80' : ''}`}>
                    {/* Header (always visible) */}
                    <div className="flex w-full items-center justify-between p-3 bg-bg-secondary hover:bg-panel-hover transition-colors group">
                      <button 
                        onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                        className="flex-1 flex items-center gap-2 text-left"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-accent" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                        <span className={`text-sm font-semibold ${isExpanded ? 'text-accent' : isCompleted ? 'text-text-muted line-through' : 'text-text-primary'}`}>{goal.title}</span>
                      </button>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-medium ${isCompleted ? 'text-accent' : 'text-text-muted'}`}>{isCompleted ? 'Completed' : `${goal.progress || 0}%`}</span>
                        
                        {isCompleted && !isHistoryView && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setState((prev: AppState) => ({ ...prev, goals: prev.goals.map((g: Goal) => g.id === goal.id ? { ...g, status: 'Archived' } : g) }));
                              }}
                              className="text-[9px] px-1.5 py-0.5 border border-card-border rounded bg-panel hover:bg-panel-hover text-text-muted hover:text-text-primary transition-colors"
                            >
                              Archive
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setState((prev: AppState) => ({ ...prev, goals: prev.goals.filter((g: Goal) => g.id !== goal.id) }));
                              }}
                              className="text-[9px] px-1.5 py-0.5 border border-danger/30 rounded bg-danger/5 hover:bg-danger/20 text-danger transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="p-3 pt-0 mt-3 space-y-3">
                        {(() => {
                          const projects = (activeState.projects || []).filter(p => p.goalId === goal.id && p.status !== 'Archived');
                          if (projects.length === 0) {
                            return <p className="text-[10px] text-text-muted italic">Generating roadmap...</p>;
                          }
                          return projects.map(project => {
                            const tasks = getGlobalSortedTasks((activeState.tasks || []).filter(t => t.projectId === project.id && t.status !== 'Archived'), Date.now());
                            const isProjCompleted = project.status === 'Completed' || project.progress === 100;
                            return (
                              <div key={project.id} className="space-y-2 group/proj">
                                <div className="flex justify-between items-center p-2 bg-bg-secondary rounded border border-card-border">
                                  <div className="flex flex-col flex-1">
                                    <span className={`text-xs font-medium ${isProjCompleted ? 'text-text-muted line-through' : 'text-text-primary'}`}>{project.title}</span>
                                    {project.description && <span className="text-[10px] text-text-secondary">{project.description}</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-medium ${isProjCompleted ? 'text-accent' : 'text-text-muted'}`}>{isProjCompleted ? 'Completed' : `${project.progress || 0}%`}</span>
                                    {isProjCompleted && !isHistoryView && (
                                       <div className="flex items-center gap-1 opacity-0 group-hover/proj:opacity-100 transition-opacity">
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setState((prev: AppState) => ({ ...prev, projects: prev.projects.map((p: Project) => p.id === project.id ? { ...p, status: 'Archived' } : p) }));
                                            }}
                                            className="text-[9px] px-1.5 py-0.5 border border-card-border rounded bg-panel hover:bg-panel-hover text-text-muted hover:text-text-primary transition-colors"
                                          >
                                            Archive
                                          </button>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setState((prev: AppState) => ({ ...prev, projects: prev.projects.filter((p: Project) => p.id !== project.id) }));
                                            }}
                                            className="text-[9px] px-1.5 py-0.5 border border-danger/30 rounded bg-danger/5 hover:bg-danger/20 text-danger transition-colors"
                                          >
                                            Delete
                                          </button>
                                       </div>
                                    )}
                                  </div>
                                </div>
                                {tasks.length > 0 && (
                                  <div className="pl-2 border-l-2 border-card-border ml-2 space-y-2">
                                    {tasks.map(task => (
                                      <PlanTaskItem key={task.id} task={task} state={state} handleTaskCheck={handleTaskCheck} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
