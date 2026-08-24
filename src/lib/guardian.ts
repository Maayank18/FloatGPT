import { useState, useEffect } from 'react';
import { AppState, Task } from '../types';
import { playSoftBeep } from './sound';
import { getSeverityAndText, SeverityState } from './time';

export type GuardianStatus = SeverityState;

export function useGuardian(state: AppState) {
  const [status, setStatus] = useState<GuardianStatus>('SAFE');
  const [activeAlert, setActiveAlert] = useState<{ id: string; title: string; timeText: string } | null>(null);

  useEffect(() => {
    const checkUrgency = () => {
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
        const severity = { SAFE: 0, WATCH: 1, WARNING: 2, CRITICAL: 3, OVERDUE: 4, EMERGENCY: 5, COMPLETED: -1, ARCHIVED: -1 };
        
        let effectiveTaskStatus = taskStatus;
        // Revert to normal state (SAFE) after 5 minutes past deadline to avoid unnecessary glow
        if (timeRemaining < 0 && Math.abs(timeRemaining) > 5 * 60 * 1000) {
            effectiveTaskStatus = 'SAFE'; 
        }

        if (severity[effectiveTaskStatus] > severity[highestStatus]) {
            highestStatus = effectiveTaskStatus;
        }
      }

      if (mostUrgentTask) {
         const tr = mostUrgentTask.deadlineAt ? (mostUrgentTask.deadlineAt - now) : 0;
         const absTr = Math.abs(tr);
         const isMinutes = absTr >= 60000;
         const displayTime = isMinutes ? `${Math.ceil(absTr / 60000)}m` : `${Math.floor(absTr / 1000)}s`;
         
         const timeText = tr < 0 
           ? `OVERDUE by ${displayTime}` 
           : (mostUrgentTask.deadlineAt ? `due in ${displayTime}` : 'High Priority Action');

         if (highestStatus !== 'SAFE') {
           newAlert = {
              id: mostUrgentTask.id,
              title: mostUrgentTask.title,
              timeText: timeText
           };
         }
      }

      let finalStatus = highestStatus;
      const sensitivity = state.settings?.productivity?.pulseSensitivity || 'Normal';
      
      if (sensitivity === 'Muted') {
         finalStatus = 'SAFE';
      } else if (sensitivity === 'Low') {
         if (finalStatus !== 'SAFE') finalStatus = 'WATCH';
      } else if (sensitivity === 'High') {
         if (finalStatus === 'WATCH') finalStatus = 'WARNING';
         if (finalStatus === 'WARNING') finalStatus = 'CRITICAL';
      }

      setStatus(finalStatus);
      setActiveAlert(newAlert);
    };

    checkUrgency();
    const intervalId = setInterval(checkUrgency, 1000);

    return () => clearInterval(intervalId);
  }, [state.tasks, state.settings?.productivity?.pulseSensitivity]);

  return { status, activeAlert };
}
