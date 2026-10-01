/**
 * FloatGPT — State Change & Event Trigger Engine
 * 
 * Evaluates entity state mutations (e.g. task completed, goal created)
 * and dispatches corresponding automations.
 */

import { ScheduledAutomation, StateChangeTriggerConfig } from './types';
import { WorkflowEngine } from './workflowEngine';
import { SchedulerService } from './scheduler';

export class TriggerEngine {
  private static lastTriggered: Map<string, number> = new Map();
  private static readonly THROTTLE_MS = 5000; // 5 seconds debounce per automation

  /**
   * Dispatches an event when an entity state changes.
   */
  static async onStateChange(
    entityType: 'task' | 'goal' | 'project',
    entityData: Record<string, any>
  ): Promise<string[]> {
    const automations = SchedulerService.getAll().filter(
      a => a.enabled && a.triggerType === 'STATE_CHANGE' && a.stateConfig
    );

    const dispatched: string[] = [];

    for (const auto of automations) {
      const cfg = auto.stateConfig!;
      if (cfg.entity !== entityType) continue;

      // Check condition match
      const actualValue = entityData[cfg.field];
      if (actualValue !== cfg.expectedValue) continue;

      // Throttle check
      const last = this.lastTriggered.get(auto.id) || 0;
      if (Date.now() - last < this.THROTTLE_MS) continue;

      this.lastTriggered.set(auto.id, Date.now());
      auto.lastRunAt = Date.now();
      auto.runCount++;

      try {
        await WorkflowEngine.executeSkill(auto.skillId, auto.parameters, {
          version: auto.skillVersion,
          workspaceState: { triggerEntity: entityData }
        });
        dispatched.push(auto.id);
      } catch (err) {
        console.error(`[TriggerEngine] Trigger execution failed for ${auto.id}:`, err);
        auto.failureCount++;
      }
    }

    return dispatched;
  }

  static clear(): void {
    this.lastTriggered.clear();
  }
}
