/**
 * FloatGPT — Automation Analytics & Value Tracker
 * 
 * Aggregates operational telemetry from workflow executions:
 * - Completion rate
 * - Verified success rate
 * - Estimated human time saved (minutes)
 * - Average execution latency
 */

import { AutomationAnalyticsRecord } from './types';
import { WorkflowExecutionRecord } from '../fabric/runtime/types';

export class AutomationAnalytics {
  private static record: AutomationAnalyticsRecord = {
    totalWorkflowsRun: 0,
    completedWorkflows: 0,
    verifiedSuccessCount: 0,
    totalDurationMs: 0,
    estimatedTimeSavedMinutes: 0,
    lastRunTimestamp: 0
  };

  /**
   * Records a completed workflow execution.
   */
  static recordExecution(exec: WorkflowExecutionRecord): void {
    this.record.totalWorkflowsRun++;
    this.record.totalDurationMs += exec.durationMs;
    this.record.lastRunTimestamp = exec.endTime || Date.now();

    if (exec.status === 'COMPLETED') {
      this.record.completedWorkflows++;
      if (exec.allStepsVerified) {
        this.record.verifiedSuccessCount++;
      }
      // Baseline: estimated 10 minutes saved per verified automated workflow
      this.record.estimatedTimeSavedMinutes += 10;
    }
  }

  static getMetrics(): AutomationAnalyticsRecord & {
    completionRatePercent: number;
    verifiedSuccessRatePercent: number;
    averageDurationSeconds: number;
  } {
    const total = this.record.totalWorkflowsRun;
    const completed = this.record.completedWorkflows;
    const verified = this.record.verifiedSuccessCount;

    return {
      ...this.record,
      completionRatePercent: total > 0 ? Math.round((completed / total) * 100) : 100,
      verifiedSuccessRatePercent: completed > 0 ? Math.round((verified / completed) * 100) : 100,
      averageDurationSeconds: total > 0 ? Math.round(this.record.totalDurationMs / total / 1000) : 0
    };
  }

  static reset(): void {
    this.record = {
      totalWorkflowsRun: 0,
      completedWorkflows: 0,
      verifiedSuccessCount: 0,
      totalDurationMs: 0,
      estimatedTimeSavedMinutes: 0,
      lastRunTimestamp: 0
    };
  }
}
