/**
 * FloatGPT — Automation Subsystem Types & Schemas
 * 
 * Defines triggers, schedules, notifications, and analytics schemas
 * for autonomous durable workflows.
 */

export type TriggerType = 
  | 'TIME'
  | 'STATE_CHANGE'
  | 'EVENT'
  | 'USER_ACTION';

export interface TimeTriggerConfig {
  intervalMinutes?: number;
  runAt?: number;
  cronExpression?: string;
  quietHoursStart?: number; // e.g. 22 for 10 PM
  quietHoursEnd?: number;   // e.g. 7 for 7 AM
}

export interface StateChangeTriggerConfig {
  entity: 'task' | 'goal' | 'project';
  field: string;
  expectedValue: any;
}

export interface ScheduledAutomation {
  id: string;
  name: string;
  skillId: string;
  skillVersion?: string;
  triggerType: TriggerType;
  timeConfig?: TimeTriggerConfig;
  stateConfig?: StateChangeTriggerConfig;
  parameters: Record<string, any>;
  enabled: boolean;
  lastRunAt?: number;
  nextRunAt?: number;
  runCount: number;
  failureCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface AutomationNotification {
  id: string;
  automationId: string;
  type: 'STARTED' | 'WAITING_FOR_PERMISSION' | 'COMPLETED' | 'FAILED' | 'REQUIRES_ATTENTION';
  title: string;
  message: string;
  timestamp: number;
  planId?: string;
}

export interface AutomationAnalyticsRecord {
  totalWorkflowsRun: number;
  completedWorkflows: number;
  verifiedSuccessCount: number;
  totalDurationMs: number;
  estimatedTimeSavedMinutes: number;
  lastRunTimestamp: number;
}
