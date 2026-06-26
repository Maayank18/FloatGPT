import { AppState, ExecutionProfile, Task } from '../types';

export class ReflectionService {
  /**
   * Called when a new task is created
   */
  static onTaskCreated(state: AppState): AppState {
    const profile = { ...state.executionProfile };
    profile._totalCreatedTasksCount += 1;
    profile.completionRatePercent = this.calculateCompletionRate(profile);
    return { ...state, executionProfile: profile };
  }

  /**
   * Called when a task is completed
   */
  static onTaskCompleted(state: AppState, task: Task): AppState {
    const profile = { ...state.executionProfile };
    const now = Date.now();

    profile._completedTasksCount += 1;
    profile.completionRatePercent = this.calculateCompletionRate(profile);

    // Calculate delay if missed deadline
    if (task.deadlineAt) {
      if (now > task.deadlineAt) {
        const delayMinutes = Math.floor((now - task.deadlineAt) / (1000 * 60));
        profile._totalDelayMinutes += delayMinutes;
        profile.averageDelayMinutes = Math.floor(profile._totalDelayMinutes / profile._completedTasksCount);
        
        profile._planningAccuracySum += 0; // Missed deadline = 0 accuracy score
      } else {
        profile._planningAccuracySum += 100; // Met deadline = 100 accuracy score
      }
      profile._planningAccuracyCount += 1;
      profile.planningAccuracyPercent = Math.floor(profile._planningAccuracySum / profile._planningAccuracyCount);
    }

    if (task.createdAt) {
      const completionTimeMinutes = Math.floor((now - task.createdAt) / (1000 * 60));
      // rolling average calculation: new_avg = old_avg + (new_val - old_avg) / n
      profile.averageCompletionTimeMinutes = Math.floor(
         profile.averageCompletionTimeMinutes + (completionTimeMinutes - profile.averageCompletionTimeMinutes) / profile._completedTasksCount
      );
    }

    // Time of day
    const hour = new Date(now).getHours();
    let timeOfDay = 'Night';
    if (hour >= 5 && hour < 12) timeOfDay = 'Morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'Evening';
    
    profile._completedByTimeOfDay[timeOfDay] = (profile._completedByTimeOfDay[timeOfDay] || 0) + 1;
    profile.preferredWorkingHours = this.getMostFrequent(profile._completedByTimeOfDay) as any || 'Unknown';

    // Weekday
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekday = weekdays[new Date(now).getDay()];
    profile._completedByWeekday[weekday] = (profile._completedByWeekday[weekday] || 0) + 1;
    profile.mostProductiveWeekday = this.getMostFrequent(profile._completedByWeekday) || 'Unknown';

    // Infer category/type if available (simple heuristic: first word of task or project context)
    const typeMatch = task.title.split(' ')[0];
    if (typeMatch && typeMatch.length > 3) {
      profile._recentCompletedTypes.push(typeMatch);
      if (profile._recentCompletedTypes.length > 10) {
         profile._recentCompletedTypes.shift();
      }
      
      if (profile._recentCompletedTypes.length >= 3) {
         profile.preferredTaskSequence = [...profile._recentCompletedTypes];
      }
    }

    return { ...state, executionProfile: profile };
  }

  /**
   * Called when a task is delayed / postponed
   */
  static onTaskPostponed(state: AppState, task: Task): AppState {
    const profile = { ...state.executionProfile };
    
    const typeMatch = task.title.split(' ')[0];
    if (typeMatch && typeMatch.length > 3) {
      profile._categoryDelays[typeMatch] = (profile._categoryDelays[typeMatch] || 0) + 1;
      
      const delayedCategories = Object.entries(profile._categoryDelays)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(entry => entry[0]);
        
      profile.frequentlyDelayedCategories = delayedCategories;
    }

    return { ...state, executionProfile: profile };
  }

  /**
   * Called when focus mode is toggled
   */
  static onFocusToggled(state: AppState, isActive: boolean): AppState {
    const profile = { ...state.executionProfile };
    
    if (isActive) {
      profile._currentFocusStartTime = Date.now();
    } else if (profile._currentFocusStartTime) {
      const durationMinutes = Math.floor((Date.now() - profile._currentFocusStartTime) / (1000 * 60));
      if (durationMinutes > 0) {
        profile._totalFocusDurationMinutes += durationMinutes;
        profile._focusSessionsCount += 1;
        profile.averageFocusDurationMinutes = Math.floor(profile._totalFocusDurationMinutes / profile._focusSessionsCount);
      }
      profile._currentFocusStartTime = undefined;
    }
    
    return { ...state, executionProfile: profile };
  }

  private static calculateCompletionRate(profile: ExecutionProfile): number {
    if (profile._totalCreatedTasksCount === 0) return 100;
    return Math.floor((profile._completedTasksCount / profile._totalCreatedTasksCount) * 100);
  }

  private static getMostFrequent(counts: Record<string, number>): string | null {
    let max = 0;
    let mostFrequent = null;
    for (const [key, count] of Object.entries(counts)) {
      if (count > max) {
        max = count;
        mostFrequent = key;
      }
    }
    return mostFrequent;
  }
}
