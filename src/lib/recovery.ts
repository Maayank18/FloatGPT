import { AppState, Task, RecoveryState } from '../types';

export class RecoveryService {
  /**
   * Analyzes the workspace and generates a recovery plan if drift is detected.
   */
  static analyzeAndRecover(state: AppState): AppState {
    const now = Date.now();
    let tasksDeferredCount = 0;
    
    const activeTasks = state.tasks.filter(t => t.status !== 'Completed' && t.status !== 'Archived');
    const overdueTasks = activeTasks.filter(t => t.deadlineAt && t.deadlineAt < now);
    
    let nextStatus: RecoveryState['status'] = 'Healthy';
    if (overdueTasks.length > 5) nextStatus = 'Mission Failure';
    else if (overdueTasks.length > 3) nextStatus = 'Critical Delay';
    else if (overdueTasks.length > 1) nextStatus = 'Moderate Delay';
    else if (overdueTasks.length === 1) nextStatus = 'Slight Drift';

    if (nextStatus === 'Healthy') {
      // If we are already in a recovery state and no new drift occurred, maintain the recovery display
      // until the day rolls over. (Rollover clears the session).
      if (state.recoveryState?.isRecovering) {
         return state; 
      }
      return {
        ...state,
        recoveryState: {
          ...state.recoveryState,
          status: 'Healthy',
          isRecovering: false,
          tasksDeferredCount: 0,
        }
      };
    }

    const hardDeadlineKeywords = ['interview', 'exam', 'meeting', 'flight', 'submission', 'urgent'];
    const isHardDeadline = (t: Task) => 
      hardDeadlineKeywords.some(k => t.title.toLowerCase().includes(k)) || 
      t.priority === 'Critical';

    const dependencyGraph = new Map<string, string[]>();
    activeTasks.forEach(t => {
      (t.dependencies || []).forEach(dep => {
        if (!dependencyGraph.has(dep)) dependencyGraph.set(dep, []);
        dependencyGraph.get(dep)!.push(t.id);
      });
    });

    const updatedTasks = [...state.tasks];
    
    // Estimate daily capacity: Hours until 10 PM (22:00) minus 20% buffer
    const currentHour = new Date(now).getHours();
    const activeHoursRemaining = Math.max(0, 22 - currentHour);
    const estimatedProductiveHours = Math.floor(activeHoursRemaining * 0.8);
    
    overdueTasks.sort((a, b) => {
      const aHard = isHardDeadline(a) ? 1 : 0;
      const bHard = isHardDeadline(b) ? 1 : 0;
      if (aHard !== bHard) return bHard - aHard; // soft tasks last to be moved... wait, we want soft tasks first?
      return 0;
    });

    const ONE_DAY = 24 * 60 * 60 * 1000;
    const profile = state.executionProfile;
    
    // Adjust target shift based on preferred working hours from reflection
    let shiftAmount = ONE_DAY;
    if (profile.preferredWorkingHours === 'Morning') {
       // if they prefer morning, ensure it lands in the morning
       const target = new Date(now + ONE_DAY);
       target.setHours(9, 0, 0, 0);
       shiftAmount = target.getTime() - now;
    }

    for (const overdueTask of overdueTasks) {
      if (!isHardDeadline(overdueTask)) {
        const taskIndex = updatedTasks.findIndex(t => t.id === overdueTask.id);
        if (taskIndex !== -1) {
          const t = updatedTasks[taskIndex];
          
          // Use reflection: if task is a frequently delayed category, push it to lower priority
          const typeMatch = t.title.split(' ')[0];
          let extraDelay = 0;
          if (profile.frequentlyDelayedCategories?.includes(typeMatch)) {
             extraDelay = 2 * 60 * 60 * 1000; // push 2 hours later
          }

          updatedTasks[taskIndex] = {
            ...t,
            deadlineAt: (t.deadlineAt || now) + shiftAmount + extraDelay,
            deferred: true,
            recovered: true
          };
          tasksDeferredCount++;

          const shiftChildren = (parentId: string) => {
            const children = dependencyGraph.get(parentId) || [];
            children.forEach(childId => {
               const childIdx = updatedTasks.findIndex(c => c.id === childId);
               if (childIdx !== -1) {
                  const child = updatedTasks[childIdx];
                  if (child.deadlineAt) {
                    updatedTasks[childIdx] = {
                      ...child,
                      deadlineAt: child.deadlineAt + shiftAmount + extraDelay,
                      deferred: true,
                      recovered: true
                    };
                    tasksDeferredCount++;
                    shiftChildren(childId);
                  }
               }
            });
          };
          shiftChildren(overdueTask.id);
        }
      }
    }

    const missionConfidencePercent = Math.max(0, 100 - (tasksDeferredCount * 5));
    const estimatedRecoveryHours = Math.ceil(tasksDeferredCount * 1.5);

    return {
      ...state,
      tasks: updatedTasks,
      recoveryState: {
        status: nextStatus,
        estimatedRecoveryHours,
        tasksDeferredCount,
        missionConfidencePercent,
        isRecovering: true,
        lastRecoveredAt: now
      }
    };
  }
}
