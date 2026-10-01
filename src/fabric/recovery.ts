/**
 * FloatGPT — Recovery Engine
 * 
 * Classifies failure modes and orchestrates safe recovery strategies.
 * Never blindly retries destructive or sensitive actions.
 */

import { StructuredAction, ActionResult } from './protocol';

export type FailureCategory =
  | 'TRANSIENT'
  | 'PERMISSION_DENIED'
  | 'TARGET_NOT_FOUND'
  | 'APPLICATION_UNAVAILABLE'
  | 'SECURITY_BLOCKED'
  | 'TIMEOUT'
  | 'UNKNOWN';

export type RecoveryStrategy =
  | 'RETRY'
  | 'FALLBACK'
  | 'REPLAN'
  | 'ASK_USER'
  | 'ABORT';

export interface RecoveryPlan {
  category: FailureCategory;
  strategy: RecoveryStrategy;
  reason: string;
  maxRetriesAllowed: number;
}

export class RecoveryEngine {
  /**
   * Evaluates a failed action result and returns a safe recovery plan.
   */
  static planRecovery(action: StructuredAction, result: ActionResult): RecoveryPlan {
    const error = (result.error || '').toLowerCase();

    // 1. Security / Permission Block
    if (result.status === 'BLOCKED' || error.includes('blocked') || error.includes('permission')) {
      return {
        category: 'SECURITY_BLOCKED',
        strategy: 'ABORT',
        reason: 'Action was blocked by policy or permission gates. Cannot be retried automatically.',
        maxRetriesAllowed: 0
      };
    }

    // 2. Destructive Actions: Never automatically retry
    if (action.risk === 'LEVEL_3_DESTRUCTIVE' || action.risk === 'LEVEL_2_SENSITIVE') {
      return {
        category: 'UNKNOWN',
        strategy: 'ASK_USER',
        reason: 'Sensitive or destructive action failed. Manual confirmation required before retry.',
        maxRetriesAllowed: 0
      };
    }

    // 3. Application or Target Not Found
    if (error.includes('not found') || error.includes('unavailable') || error.includes('missing')) {
      return {
        category: 'TARGET_NOT_FOUND',
        strategy: 'FALLBACK',
        reason: 'Target application or resource was not found. Attempting fallback adapter or alternative path.',
        maxRetriesAllowed: 1
      };
    }

    // 4. Timeout
    if (error.includes('timeout') || error.includes('timed out')) {
      return {
        category: 'TIMEOUT',
        strategy: 'RETRY',
        reason: 'Operation timed out. Safe to retry once.',
        maxRetriesAllowed: 1
      };
    }

    // Default safe failure handling
    return {
      category: 'UNKNOWN',
      strategy: 'ABORT',
      reason: 'Unclassified failure. Safe abort to prevent cascading errors.',
      maxRetriesAllowed: 0
    };
  }
}
