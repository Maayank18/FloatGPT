import React, { useState, useEffect } from 'react';
import { AppState, Goal, Task, Project } from '../../types';
import { Plus, FolderKanban, ChevronDown, ChevronRight, CheckSquare, Square, CalendarClock, Trash2, Archive, CheckCheck, Sparkles, Check } from 'lucide-react';
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
    <div className={`flex items-start gap-2 p-2 border rounded-lg transition-colors ${isCompleted ? 'bg-card/40 border-card-border/40 opacity-80' : 'bg-card border-card-border hover:border-accent/40'}`}>
      <button 
        type="button"
        onClick={() => !isCompleted && handleTaskCheck(task.id, task.status)}
        disabled={isCompleted}
        className={`mt-0.5 transition-colors shrink-0 ${isCompleted ? 'text-accent cursor-default' : 'text-text-muted hover:text-accent cursor-pointer'}`}
        title={isCompleted ? 'Completed (Permanent)' : 'Click to complete'}
      >
        {isCompleted ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] leading-tight truncate ${isCompleted ? 'text-text-muted line-through font-normal' : 'text-text-primary font-medium'}`}>
            {task.title}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {isCompleted && (
              <span className="text-[8px] bg-accent/15 text-accent border border-accent/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                Done
              </span>
            )}
            <ExplainPopover task={task} state={state} context="Queue" />
          </div>
        </div>

        {(!isCompleted && (task.deadlineAt || task.priority || task.estimatedEffort || task.carriedOver)) && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {task.deadlineAt && (
              <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-medium tracking-wider ${isEmergencyTheme ? 'bg-danger/20 text-danger border border-danger/30 font-bold' : isCritical ? 'bg-warning/20 text-warning border border-warning/30' : 'bg-accent/10 text-accent border border-accent/20'}`}>
                {countdown.text}
              </span>
            )}
            {task.carriedOver && (
              <span className="text-[8px] bg-warning/20 text-warning px-1.5 py-0.5 rounded uppercase tracking-wider">Carried over</span>
            )}
            {task.recovered && (
              <span className="text-[8px] bg-warning/20 text-warning px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Recovered</span>
            )}
            {task.deferred && (
              <span className="text-[8px] bg-card-border text-text-secondary px-1.5 py-0.5 rounded uppercase tracking-wider">Deferred</span>
            )}
            {task.split && (
              <span className="text-[8px] bg-accent/20 text-accent px-1.5 py-0.5 rounded uppercase tracking-wider">Split</span>
            )}
            {task.priority && (
              <span className="text-[8px] bg-card-border text-text-muted px-1.5 py-0.5 rounded uppercase">Pri: {task.priority}</span>
            )}
            {task.estimatedEffort && (
              <span className="text-[8px] bg-card-border text-text-secondary px-1.5 py-0.5 rounded uppercase">{task.estimatedEffort}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

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

  const [newGoal, setNewGoal] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(activeState.goals[0]?.id || null);
  const [viewTab, setViewTab] = useState<'active' | 'archived'>('active');

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

  /**
   * Completes a task permanently. 
   * Strict Immutability: Once marked Completed, it cannot be reversed.
   */
  const handleTaskCheck = async (taskId: string, currentStatus: string) => {
    if (isHistoryView) return;
    // Irreversible: If already Completed or Archived, never toggle back
    if (currentStatus === 'Completed' || currentStatus === 'Archived') return;
    
    // Optimistic update
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

  /**
   * Clears/Archives all completed goals, projects, and tasks to reclaim screen space.
   */
  const handleClearCompletedPlans = () => {
    if (isHistoryView) return;
    setState((prev: AppState) => {
      // Find all completed goals and projects
      const updatedGoals = prev.goals.map(g => (g.progress === 100 || g.status === 'Completed') ? { ...g, status: 'Archived' as const } : g);
      const updatedProjects = prev.projects.map(p => (p.progress === 100 || p.status === 'Completed') ? { ...p, status: 'Archived' as const } : p);
      const updatedTasks = prev.tasks.map(t => t.status === 'Completed' ? { ...t, status: 'Archived' as const } : t);
      
      return {
        ...prev,
        goals: updatedGoals,
        projects: updatedProjects,
        tasks: updatedTasks
      };
    });
  };

  /**
   * Clears completed tasks for a specific project
   */
  const handleClearProjectDoneTasks = (projectId: string) => {
    if (isHistoryView) return;
    setState((prev: AppState) => ({
      ...prev,
      tasks: prev.tasks.map(t => t.projectId === projectId && t.status === 'Completed' ? { ...t, status: 'Archived' as const } : t)
    }));
  };

  // Filter goals based on viewTab
  const activeGoals = activeState.goals.filter(g => g.status !== 'Archived');
  const visibleGoals = viewTab === 'active' 
    ? activeGoals.filter(g => g.status !== 'Completed' && (g.progress || 0) < 100)
    : activeGoals.filter(g => g.status === 'Completed' || (g.progress || 0) === 100);

  const completedGoalsCount = activeGoals.filter(g => g.status === 'Completed' || (g.progress || 0) === 100).length;
  const completedTasksCount = activeState.tasks.filter(t => t.status === 'Completed').length;
  const hasCompletedItems = completedGoalsCount > 0 || completedTasksCount > 0;

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

      {/* Top Header & Actions */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <FolderKanban className="w-3.5 h-3.5 text-accent" /> Plan
          </h3>
          {/* Tab Selector */}
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
            placeholder="Goal title..." 
            className="flex-1 bg-card border border-card-border rounded-md px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent" 
          />
          <button type="submit" className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-md hover:bg-accent-hover cursor-pointer">Add</button>
        </form>
      )}

      <div className="space-y-4">
        {visibleGoals.length === 0 && !isAdding ? (
          <div className="text-center py-8 border border-dashed border-card-border rounded-lg bg-bg-secondary">
            {viewTab === 'active' && completedGoalsCount > 0 ? (
              <div className="space-y-1">
                <CheckCheck className="w-6 h-6 text-accent mx-auto mb-2 opacity-80" />
                <p className="text-[12px] font-bold text-text-primary">All Plans Completed! 🎯</p>
                <p className="text-[10px] text-text-muted px-4">Your active workspace is clean. Create a new plan in chat anytime.</p>
              </div>
            ) : (
              <div>
                <p className="text-[11px] font-medium text-text-secondary mb-1">No plan active</p>
                <p className="text-[10px] text-text-muted px-4">Just mention a task, deadline, or goal in Chat to start automatically.</p>
              </div>
            )}
          </div>
        ) : (
          visibleGoals.length > 0 && (
            <div className="space-y-3">
              {visibleGoals.map(goal => {
                const isExpanded = expandedGoalId === goal.id;
                const isCompleted = goal.status === 'Completed' || (goal.progress || 0) === 100;
                
                return (
                  <div key={goal.id} className={`border border-card-border bg-card rounded-lg overflow-hidden transition-all ${isCompleted ? 'opacity-80' : ''}`}>
                    {/* Header (always visible) */}
                    <div className="flex w-full items-center justify-between p-3 bg-bg-secondary hover:bg-panel-hover transition-colors group">
                      <button 
                        onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                        className="flex-1 flex items-center gap-2 text-left cursor-pointer"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-accent" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                        <span className={`text-sm font-semibold ${isExpanded ? 'text-accent' : isCompleted ? 'text-text-muted line-through' : 'text-text-primary'}`}>{goal.title}</span>
                      </button>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isCompleted ? 'bg-accent/15 text-accent' : 'bg-card border border-card-border text-text-muted'}`}>
                          {isCompleted ? '100% Done' : `${goal.progress || 0}%`}
                        </span>
                        
                        {!isHistoryView && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setState((prev: AppState) => ({ ...prev, goals: prev.goals.map((g: Goal) => g.id === goal.id ? { ...g, status: 'Archived' } : g) }));
                              }}
                              className="text-[9px] px-1.5 py-0.5 border border-card-border rounded bg-panel hover:bg-panel-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                              title="Archive Goal to remove from screen"
                            >
                              Archive
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setState((prev: AppState) => ({ ...prev, goals: prev.goals.filter((g: Goal) => g.id !== goal.id) }));
                              }}
                              className="text-[9px] px-1.5 py-0.5 border border-danger/30 rounded bg-danger/5 hover:bg-danger/20 text-danger transition-colors cursor-pointer"
                              title="Delete Goal"
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
                            const isProjCompleted = project.status === 'Completed' || (project.progress || 0) === 100;
                            const completedTasksInProj = tasks.filter(t => t.status === 'Completed').length;
                            
                            return (
                              <div key={project.id} className="space-y-2 group/proj">
                                <div className="flex justify-between items-center p-2.5 bg-bg-secondary rounded-lg border border-card-border gap-2">
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className={`text-xs font-semibold leading-tight truncate ${isProjCompleted ? 'text-text-muted line-through' : 'text-text-primary'}`}>{project.title}</span>
                                    {project.description && <span className="text-[10px] text-text-secondary truncate mt-0.5">{project.description}</span>}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isProjCompleted ? (
                                      <span className="text-[8px] font-bold text-accent px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20">
                                        Done
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-mono font-medium text-text-muted">
                                        {project.progress || 0}%
                                      </span>
                                    )}
                                    
                                    {!isHistoryView && (
                                       <div className="flex items-center gap-1">
                                          {completedTasksInProj > 0 && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleClearProjectDoneTasks(project.id);
                                              }}
                                              className="text-[9px] px-1.5 py-0.5 border border-accent/30 rounded bg-accent/10 hover:bg-accent/20 text-accent transition-colors cursor-pointer"
                                              title="Clear completed tasks in this project"
                                            >
                                              Clear Done
                                            </button>
                                          )}
                                          <button 
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setState((prev: AppState) => ({ ...prev, projects: prev.projects.map((p: Project) => p.id === project.id ? { ...p, status: 'Archived' } : p) }));
                                            }}
                                            className="text-[9px] px-1.5 py-0.5 border border-card-border rounded bg-panel hover:bg-panel-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                                            title="Archive Project"
                                          >
                                            Archive
                                          </button>
                                          <button 
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setState((prev: AppState) => ({ ...prev, projects: prev.projects.filter((p: Project) => p.id !== project.id) }));
                                            }}
                                            className="text-[9px] px-1.5 py-0.5 border border-danger/30 rounded bg-danger/5 hover:bg-danger/20 text-danger transition-colors cursor-pointer"
                                            title="Delete Project"
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
