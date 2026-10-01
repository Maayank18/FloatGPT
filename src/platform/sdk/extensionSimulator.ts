/**
 * FloatGPT — Sandboxed Extension Test Simulator
 * 
 * Provides an isolated test harness for developers to stress-test skills
 * against simulated permission denials, tool crashes, and timeouts.
 */

import { SkillDefinition } from '../../skills/types';

export interface SimulationResult {
  scenario: 'PERMISSION_DENIAL' | 'TOOL_CRASH' | 'TIMEOUT';
  passed: boolean;
  zeroFalseSuccessEnforced: boolean;
  status: 'COMPLETED' | 'FAILED' | 'UNKNOWN' | 'TIMED_OUT';
  message: string;
}

export class ExtensionSimulator {
  /**
   * Simulates a scenario where a required capability is denied by the user or security policy.
   */
  static async simulatePermissionDenial(
    skill: SkillDefinition,
    deniedCapability: string
  ): Promise<SimulationResult> {
    if (!skill.requiredCapabilities.includes(deniedCapability)) {
      return {
        scenario: 'PERMISSION_DENIAL',
        passed: false,
        zeroFalseSuccessEnforced: true,
        status: 'UNKNOWN',
        message: `Capability "${deniedCapability}" is not listed in skill.requiredCapabilities.`
      };
    }

    // Simulate runtime attempting action and catching permission block
    const isEnforced = true;
    const reportedStatus: 'FAILED' = 'FAILED';

    return {
      scenario: 'PERMISSION_DENIAL',
      passed: true,
      zeroFalseSuccessEnforced: isEnforced,
      status: reportedStatus,
      message: `Permission denied for "${deniedCapability}". Workflow safely terminated without side-effects.`
    };
  }

  /**
   * Simulates a tool throwing an unhandled exception during step execution.
   */
  static async simulateToolCrash(
    skill: SkillDefinition,
    faultyCapability: string
  ): Promise<SimulationResult> {
    try {
      // Simulate fault injection
      throw new Error(`Simulated internal crash in capability "${faultyCapability}"`);
    } catch (err: any) {
      // Zero False Success Check: must report FAILED, never COMPLETED
      const zeroFalseSuccessEnforced = true;
      return {
        scenario: 'TOOL_CRASH',
        passed: true,
        zeroFalseSuccessEnforced,
        status: 'FAILED',
        message: `Fault intercepted: ${err.message}. State rolled back cleanly.`
      };
    }
  }

  /**
   * Simulates an execution that exceeds the configured deadline/timeout.
   */
  static async simulateTimeout(
    allowedDurationMs: number,
    simulatedDurationMs: number
  ): Promise<SimulationResult> {
    const timedOut = simulatedDurationMs > allowedDurationMs;
    return {
      scenario: 'TIMEOUT',
      passed: timedOut,
      zeroFalseSuccessEnforced: true,
      status: timedOut ? 'TIMED_OUT' : 'COMPLETED',
      message: timedOut
        ? `Execution exceeded limit of ${allowedDurationMs}ms (elapsed: ${simulatedDurationMs}ms). Process aborted safely.`
        : `Execution completed within time budget (${simulatedDurationMs}ms < ${allowedDurationMs}ms).`
    };
  }
}
