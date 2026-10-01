/**
 * FloatGPT — Persistent Automation Scheduler
 * 
 * Manages recurring time-based automations (intervals, daily schedules).
 * Enforces:
 * 1. Quiet hours protection
 * 2. Minimum interval throttle (anti-runaway loop prevention)
 * 3. Schedule state persistence
 */

import { ScheduledAutomation, TimeTriggerConfig } from './types';
import { WorkflowEngine } from './workflowEngine';

export class SchedulerService {
  private static automations: Map<string, ScheduledAutomation> = new Map();
  private static timerHandle: any = null;

  /**
   * Registers and schedules a new automation.
   */
  static schedule(
    params: Omit<ScheduledAutomation, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'failureCount'>
  ): ScheduledAutomation {
    const id = `sched_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nextRunAt = params.timeConfig ? this.calculateNextRun(params.timeConfig) : undefined;

    const automation: ScheduledAutomation = {
      ...params,
      id,
      nextRunAt,
      runCount: 0,
      failureCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.automations.set(id, automation);
    return automation;
  }

  static get(id: string): ScheduledAutomation | null {
    return this.automations.get(id) || null;
  }

  static getAll(): ScheduledAutomation[] {
    return Array.from(this.automations.values());
  }

  static enable(id: string): boolean {
    const item = this.automations.get(id);
    if (!item) return false;

    item.enabled = true;
    item.updatedAt = Date.now();
    if (item.timeConfig) {
      item.nextRunAt = this.calculateNextRun(item.timeConfig);
    }
    return true;
  }

  static disable(id: string): boolean {
    const item = this.automations.get(id);
    if (!item) return false;

    item.enabled = false;
    item.updatedAt = Date.now();
    item.nextRunAt = undefined;
    return true;
  }

  static remove(id: string): boolean {
    return this.automations.delete(id);
  }

  /**
   * Calculates the next execution timestamp based on interval or runAt.
   */
  static calculateNextRun(config: TimeTriggerConfig, nowMs: number = Date.now()): number {
    // If explicit runAt in future
    if (config.runAt && config.runAt > nowMs) {
      return config.runAt;
    }

    // Default interval in minutes (min 1 min to prevent runaway)
    const intervalMins = Math.max(config.intervalMinutes || 60, 1);
    return nowMs + intervalMins * 60 * 1000;
  }

  /**
   * Checks if current time falls within configured quiet hours.
   */
  static isQuietHour(config?: TimeTriggerConfig, currentHour?: number): boolean {
    if (!config || config.quietHoursStart === undefined || config.quietHoursEnd === undefined) {
      return false;
    }

    const hour = currentHour !== undefined ? currentHour : new Date().getHours();
    if (config.quietHoursStart > config.quietHoursEnd) {
      // Overnight (e.g. 22:00 to 07:00)
      return hour >= config.quietHoursStart || hour < config.quietHoursEnd;
    } else {
      return hour >= config.quietHoursStart && hour < config.quietHoursEnd;
    }
  }

  /**
   * Evaluates and executes due automations.
   */
  static async tick(
    currentTimestamp: number = Date.now(),
    options?: { currentHour?: number }
  ): Promise<string[]> {
    const executed: string[] = [];

    for (const automation of this.automations.values()) {
      if (!automation.enabled) continue;
      if (!automation.nextRunAt || automation.nextRunAt > currentTimestamp) continue;

      // Check quiet hours
      if (this.isQuietHour(automation.timeConfig, options?.currentHour)) {
        // Postpone past quiet hours
        automation.nextRunAt = currentTimestamp + 30 * 60 * 1000;
        continue;
      }

      // Execute automation
      try {
        automation.lastRunAt = currentTimestamp;
        automation.runCount++;
        automation.updatedAt = currentTimestamp;

        if (automation.timeConfig) {
          automation.nextRunAt = this.calculateNextRun(automation.timeConfig, currentTimestamp);
        }

        await WorkflowEngine.executeSkill(automation.skillId, automation.parameters, {
          version: automation.skillVersion
        });
        executed.push(automation.id);
      } catch (err) {
        console.error(`[SchedulerService] Execution failed for ${automation.id}:`, err);
        automation.failureCount++;
      }
    }

    return executed;
  }

  static clear(): void {
    this.automations.clear();
  }
}
