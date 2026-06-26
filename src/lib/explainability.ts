import { AppState, Task } from '../types';
import { getPriorityScore, isTaskReady } from './time';

export interface Explanation {
  reasons: string[];
  confidencePercent?: number;
}

export class ExplainabilityService {
  static explainTask(task: Task, state: AppState, context: string): Explanation {
    const reasons: string[] = [];
    const now = Date.now();
    let confidence: number | undefined;

    // Line 1: Primary reason for selection
    let primaryReason = '';

    if (task.carriedOver) {
        if (task.deadlineAt && task.deadlineAt < now) {
           primaryReason = `"${task.title}" was carried over from yesterday and is now overdue.`;
        } else {
           primaryReason = `"${task.title}" is carried over from yesterday to ensure it doesn't slip through the cracks.`;
        }
    } else if (task.recovered) {
        primaryReason = `Your schedule was rebuilt and "${task.title}" was prioritized to get you back on track.`;
    } else if (task.deferred) {
        primaryReason = `"${task.title}" was deferred to make room for more critical deadlines today.`;
    } else if (context === 'TimeCritical' && task.deadlineAt) {
        const minsRemaining = Math.floor((task.deadlineAt - now) / 60000);
        if (minsRemaining < 0) {
            const hours = Math.floor(Math.abs(minsRemaining) / 60);
            primaryReason = `"${task.title}" is selected because it is overdue by ${hours > 0 ? `${hours} hour${hours > 1 ? 's' : ''}` : `${Math.abs(minsRemaining)} minutes`}.`;
        } else if (minsRemaining < 60) {
            primaryReason = `"${task.title}" is first because it is due in ${minsRemaining} minutes.`;
        } else {
            const hours = Math.floor(minsRemaining / 60);
            primaryReason = `"${task.title}" is prioritized because it is due in ${hours} hour${hours !== 1 ? 's' : ''}.`;
        }
    } else if (context === 'Strategic' || context === 'Focus') {
       if (task.priority === 'High' || task.priority === 'Critical') {
            primaryReason = `"${task.title}" is chosen as your primary focus due to its ${task.priority.toLowerCase()} strategic impact.`;
       } else if (task.priority === 'Medium') {
            primaryReason = `"${task.title}" is selected as your current strategic focus based on its priority.`;
       } else {
            primaryReason = `"${task.title}" is selected as your current focus action.`;
       }
    } else {
        if (task.deadlineAt) {
            const hours = Math.floor((task.deadlineAt - now) / 3600000);
            if (hours > 0) {
                primaryReason = `"${task.title}" is next in your queue, due in ${hours} hour${hours !== 1 ? 's' : ''}.`;
            } else {
                primaryReason = `"${task.title}" is next in your execution queue.`;
            }
        } else {
            primaryReason = `"${task.title}" is the next logical step in your queue.`;
        }
    }

    reasons.push(primaryReason);

    // Line 2: Dependencies or blockers
    const allTasks = state.tasks || [];
    const blocksOthers = allTasks.filter(t => t.dependencies?.includes(task.id) && t.status !== 'Completed' && t.status !== 'Archived').length;
    if (blocksOthers > 0) {
        reasons.push(`Completing this unlocks ${blocksOthers} dependent task${blocksOthers > 1 ? 's' : ''} in your plan.`);
    }

    const ready = isTaskReady(task.id, allTasks);
    if (!ready) {
        reasons.push("Note: This task is currently blocked by other incomplete tasks.");
    }

    // Line 3: Reflection insights / Habits
    const profile = state.executionProfile;
    if (profile && reasons.length < 3) {
      const typeMatch = task.title.split(' ')[0];
      if (profile.frequentlyDelayedCategories?.includes(typeMatch)) {
         reasons.push(`You frequently delay similar tasks, so it has been scheduled deliberately.`);
      } else {
          const hour = new Date(now).getHours();
          let timeOfDay = 'Night';
          if (hour >= 5 && hour < 12) timeOfDay = 'Morning';
          else if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon';
          else if (hour >= 17 && hour < 21) timeOfDay = 'Evening';
          
          if (profile.preferredWorkingHours === timeOfDay && timeOfDay !== 'Unknown') {
             reasons.push(`FloatGPT scheduled this now because ${timeOfDay.toLowerCase()} is your strongest productivity window.`);
          }
      }
    }

    // Determine meaningful confidence
    let strongSignals = 0;
    if (task.deadlineAt) strongSignals++;
    if (task.priority === 'High' || task.priority === 'Critical') strongSignals++;
    if (blocksOthers > 0) strongSignals++;
    if (task.carriedOver) strongSignals++;
    if (task.recovered) strongSignals++;

    if (strongSignals >= 2) {
        confidence = 95;
    } else if (strongSignals === 1) {
        confidence = 85;
    }

    return {
      reasons: reasons.slice(0, 3),
      confidencePercent: confidence
    };
  }

  static explainRecommendation(recommendation: any, state: AppState): Explanation {
    const reasons: string[] = [];
    let confidence = 85;

    reasons.push("This recommendation was generated by your AI reflection agent based on recent activity.");
    
    if (recommendation.type === 'coaching') {
       reasons.push("Coaching insights are designed to improve your long-term execution profile.");
    } else if (recommendation.type === 'warning') {
       reasons.push("This warning highlights a potential risk to your current mission deadlines.");
       confidence += 10;
    } else {
       reasons.push("Suggestions are opportunistic tasks that align with your strategic goals.");
    }

    if (state.executionProfile && state.executionProfile.mostProductiveWeekday) {
      reasons.push(`Tailored to your habits (e.g. peak productivity on ${state.executionProfile.mostProductiveWeekday}s).`);
    }

    return {
      reasons,
      confidencePercent: confidence
    };
  }
}
