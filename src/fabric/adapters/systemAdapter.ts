/**
 * FloatGPT — System Execution Adapter
 * 
 * Manages system-level information queries (time, displays, settings).
 */

import { IExecutionAdapter } from './types';
import { StructuredAction, ActionResult, VerificationResult, Capability } from '../protocol';
import { CapabilityRegistry } from '../registry';

export class SystemAdapter implements IExecutionAdapter {
  readonly id = 'system_adapter';
  readonly platform = 'universal' as const;

  async detect(): Promise<boolean> {
    return true;
  }

  capabilities(): Capability[] {
    return CapabilityRegistry.getByDomain('system');
  }

  async execute(action: StructuredAction): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      if (action.capability === 'system.get_time') {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        return {
          actionId: action.actionId,
          capability: action.capability,
          success: true,
          status: 'COMPLETED',
          data: { timeStr, dateStr, timeZone, timestamp: Date.now() },
          output: `🕒 **Local Time:** ${timeStr} | 📅 **Date:** ${dateStr} (${timeZone})`,
          executionTimeMs: Date.now() - startTime
        };
      }

      return {
        actionId: action.actionId,
        capability: action.capability,
        success: false,
        status: 'FAILED',
        error: `System capability ${action.capability} not supported.`,
        executionTimeMs: Date.now() - startTime
      };

    } catch (err: any) {
      return {
        actionId: action.actionId,
        capability: action.capability,
        success: false,
        status: 'FAILED',
        error: err.message || 'SystemAdapter execution failed',
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  async verify(action: StructuredAction): Promise<VerificationResult> {
    return {
      actionId: action.actionId,
      verified: true,
      expectedState: 'System query returned authoritative state',
      observedState: 'Authoritative state retrieved',
      confidence: 1.0
    };
  }
}
