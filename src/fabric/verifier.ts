/**
 * FloatGPT — Observation & Verification Engine
 * 
 * Asserts whether an action accomplished its expected outcome.
 * Never assumes execution equates to success.
 */

import { StructuredAction, ActionResult, VerificationResult } from './protocol';
import { IExecutionAdapter } from './adapters/types';

export class VerificationEngine {
  /**
   * Performs post-execution verification using the responsible adapter.
   * Enforces Zero False Success: When state diff or evidence is inconclusive,
   * verification status MUST be reported as UNKNOWN (confidence < 0.5), never premature success.
   */
  static async verify(
    action: StructuredAction,
    result: ActionResult,
    adapter: IExecutionAdapter
  ): Promise<VerificationResult> {
    if (!result.success) {
      return {
        actionId: action.actionId,
        verified: false,
        status: 'FAILED',
        expectedState: 'Successful execution',
        observedState: `Execution failed: ${result.error || 'Unknown error'}`,
        confidence: 1.0,
        notes: 'Action execution failed at adapter layer.'
      };
    }

    try {
      const adapterVerification = await adapter.verify(action);

      // If adapter reported verified but confidence is too low or evidence is absent
      if (adapterVerification.confidence !== undefined && adapterVerification.confidence < 0.5) {
        return {
          actionId: action.actionId,
          verified: false,
          status: 'UNKNOWN',
          expectedState: adapterVerification.expectedState || 'Observable state change',
          observedState: adapterVerification.observedState || 'Inconclusive post-state evidence',
          confidence: adapterVerification.confidence,
          evidence: adapterVerification.evidence,
          notes: 'Zero False Success: Confidence below threshold (< 0.50). Status marked UNKNOWN.'
        };
      }

      return {
        ...adapterVerification,
        status: adapterVerification.status || (adapterVerification.verified ? 'VERIFIED' : 'FAILED')
      };
    } catch (err: any) {
      return {
        actionId: action.actionId,
        verified: false,
        status: 'UNKNOWN',
        expectedState: 'Adapter verified state',
        observedState: `Verification exception: ${err.message}`,
        confidence: 0.2,
        notes: 'Verification assertion threw an exception. Marked UNKNOWN.'
      };
    }
  }
}

