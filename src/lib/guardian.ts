import { useState, useEffect } from 'react';
import { AppState, Task } from '../types';
import { playSoftBeep } from './sound';
import { getSeverityAndText, SeverityState } from './time';

export type GuardianStatus = SeverityState;

export function useGuardian(state: AppState) {
  const [status, setStatus] = useState<GuardianStatus>('SAFE');
  const [activeAlert, setActiveAlert] = useState<{ id: string; title: string; timeText: string } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let highestStatus: GuardianStatus = 'SAFE';
      let newAlert: { id: string; title: string; timeText: string } | null = null;
      
      const allIncompleteTasks = (state.tasks || []).filter(t => t.status !== 'Completed' && t.status !== 'Archived');
      
      let minTimeRemaining = Infinity;
      let mostUrgentTask: Task | null = null;

      for (const task of allIncompleteTasks) {
        if (!task.deadlineAt) continue;
        const timeRemaining = task.deadlineAt - now;
        
        if (timeRemaining < minTimeRemaining && timeRemaining > - (24 * 60 * 60 * 1000)) { // Consider up to 24h overdue for max urgency
           minTimeRemaining = timeRemaining;
           mostUrgentTask = task;
        }

        const { state: taskStatus } = getSeverityAndText(task, now);

        // Determine highest status for the orb
        const severity = { SAFE: 0, WATCH: 1, WARNING: 2, CRITICAL: 3, EMERGENCY: 4, OVERDUE: 5, COMPLETED: -1, ARCHIVED: -1 };
        if (severity[taskStatus] > severity[highestStatus]) {
           if (taskStatus === 'OVERDUE' && highestStatus === 'EMERGENCY') {
               highestStatus = 'EMERGENCY';
           } else {
               highestStatus = taskStatus;
           }
        }
      }

      if (mostUrgentTask && mostUrgentTask.deadlineAt) {
         const tr = mostUrgentTask.deadlineAt - now;
         const minutes = Math.floor(tr / (1000 * 60));
         if (tr >= 0 && tr <= 10 * 60 * 1000) {
            newAlert = {
               id: mostUrgentTask.id,
               title: mostUrgentTask.title,
               timeText: minutes === 0 ? 'Due now' : `starts in ${minutes} minute${minutes > 1 ? 's' : ''}`
            };
         }
      }

      setStatus(highestStatus);
      setActiveAlert(newAlert);

    }, 1000);

    return () => clearInterval(interval);
  }, [state.tasks]);

  return { status, activeAlert };
}
