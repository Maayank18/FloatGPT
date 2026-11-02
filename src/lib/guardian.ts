import { useState, useEffect, useRef } from 'react';
import { AppState, Task } from '../types';
import { playSoftBeep } from './sound';
import { getSeverityAndText, SeverityState, shortDeadlineLabel } from './time';

export type GuardianStatus = SeverityState;

export function applyPulseSensitivity(status: GuardianStatus, sensitivity: string): GuardianStatus {
  if (sensitivity === 'Muted') return 'SAFE';
  if (sensitivity === 'Low') {
    if (status === 'EMERGENCY' || status === 'OVERDUE' || status === 'SAFE') return status;
    return 'WATCH';
  }
  if (sensitivity === 'High') {
    if (status === 'WATCH') return 'WARNING';
    if (status === 'WARNING') return 'CRITICAL';
  }
  return status;
}

export interface ActiveAlertInfo {
  id: string;
  milestoneKey: string; // e.g. "task123_1h" or "task123_10m"
  title: string;
  timeText: string;
  severity: 'WARNING' | 'EMERGENCY';
}

export type CloudBand = 'WARNING' | 'CRITICAL' | 'EMERGENCY' | 'OVERDUE';

/** The task that is currently painting the orb. Stays up for the whole colored period. */
export interface StatusCloud {
  taskId: string;
  band: CloudBand;
  title: string;
  timeText: string;
}

export function useGuardian(state: AppState) {
  const [status, setStatus] = useState<GuardianStatus>('SAFE');
  const [activeAlert, setActiveAlert] = useState<ActiveAlertInfo | null>(null);
  const [statusCloud, setStatusCloud] = useState<StatusCloud | null>(null);
  const firedMilestonesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkUrgency = () => {
      const now = Date.now();
      const sensitivity = state.settings?.productivity?.pulseSensitivity || 'Normal';
      let highestStatus: GuardianStatus = 'SAFE';
      let winner: { task: Task; status: GuardianStatus; deadlineAt: number } | null = null;
      
      const allIncompleteTasks = (state.tasks || []).filter(t => t.status !== 'Completed' && t.status !== 'Archived');
      
      for (const task of allIncompleteTasks) {
        if (!task.deadlineAt) continue;
        const timeRemaining = task.deadlineAt - now;

        const { state: taskStatus } = getSeverityAndText(task, now);

        // Determine highest status for the orb glow
        const severityScores = { SAFE: 0, WATCH: 1, WARNING: 2, CRITICAL: 3, OVERDUE: 4, EMERGENCY: 5, COMPLETED: -1, ARCHIVED: -1 };
        
        let effectiveTaskStatus = taskStatus;
        if (timeRemaining < 0 && Math.abs(timeRemaining) > 5 * 60 * 1000) {
          effectiveTaskStatus = 'SAFE'; 
        }

        if (severityScores[effectiveTaskStatus] > severityScores[highestStatus]) {
          highestStatus = effectiveTaskStatus;
        }
        const winnerScore = winner ? severityScores[winner.status] : -1;
        const sameBandSooner = winner && effectiveTaskStatus === winner.status && task.deadlineAt < winner.deadlineAt;
        if (!winner || severityScores[effectiveTaskStatus] > winnerScore || sameBandSooner) {
          winner = { task, status: effectiveTaskStatus, deadlineAt: task.deadlineAt };
        }

        // ── Milestone Alerts: Fire ONCE at 1 Hour (Yellow) and ONCE at 10 Min (Red) ──
        const absTr = Math.abs(timeRemaining);
        const isMinutes = absTr >= 60000;
        const displayTime = isMinutes ? `${Math.ceil(absTr / 60000)}m` : `${Math.floor(absTr / 1000)}s`;
        const timeText = timeRemaining < 0 
          ? `OVERDUE by ${displayTime}` 
          : `due in ${displayTime}`;

        // Milestone 1: Exactly 1 Hour Left (<= 60m and > 10m)
        if (timeRemaining > 0 && timeRemaining <= 60 * 60 * 1000 && timeRemaining > 10 * 60 * 1000) {
          const key = `${task.id}_1h`;
          if (!firedMilestonesRef.current.has(key)) {
            firedMilestonesRef.current.add(key);
            setActiveAlert({
              id: task.id,
              milestoneKey: key,
              title: task.title,
              timeText,
              severity: 'WARNING'
            });
            if (sensitivity !== 'Muted') playSoftBeep();
          }
        }

        // Milestone 2: Exactly 10 Minutes Left (<= 10m) or Overdue
        if (timeRemaining <= 10 * 60 * 1000 && timeRemaining >= -5 * 60 * 1000) {
          const key = `${task.id}_10m`;
          if (!firedMilestonesRef.current.has(key)) {
            firedMilestonesRef.current.add(key);
            setActiveAlert({
              id: task.id,
              milestoneKey: key,
              title: task.title,
              timeText,
              severity: 'EMERGENCY'
            });
            if (sensitivity !== 'Muted') playSoftBeep();
          }
        }
      }

      const finalStatus = applyPulseSensitivity(highestStatus, sensitivity);

      setStatus(finalStatus);

      const band = finalStatus === 'WARNING' || finalStatus === 'CRITICAL' || finalStatus === 'EMERGENCY' || finalStatus === 'OVERDUE'
        ? finalStatus
        : null;
      const nextCloud: StatusCloud | null = band && winner
        ? {
            taskId: winner.task.id,
            band,
            title: winner.task.title,
            timeText: shortDeadlineLabel(winner.deadlineAt, now),
          }
        : null;
      setStatusCloud((prev) => {
        if (!nextCloud) return prev ? null : prev;
        if (prev && prev.taskId === nextCloud.taskId && prev.band === nextCloud.band && prev.title === nextCloud.title && prev.timeText === nextCloud.timeText) return prev;
        return nextCloud;
      });
    };

    checkUrgency();
    const intervalId = setInterval(checkUrgency, 1000);

    return () => clearInterval(intervalId);
  }, [state.tasks, state.settings?.productivity?.pulseSensitivity]);

  return { status, activeAlert, statusCloud, clearAlert: () => setActiveAlert(null) };
}
