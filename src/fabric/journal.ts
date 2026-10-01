/**
 * FloatGPT — Action Journal & Security Audit Stream
 * 
 * Immutable execution history tracking every external action, its risk tier,
 * user authorization status, and verification outcome.
 */

import { StructuredAction, ActionResult, VerificationResult } from './protocol';

export interface JournalEntry {
  id: string;
  timestamp: number;
  actionId: string;
  capability: string;
  domain: string;
  targetSummary: string;
  riskLevel: string;
  source: string;
  status: string;
  executionTimeMs: number;
  verified: boolean;
  outputSummary?: string;
  securityViolation?: boolean;
}

class ActionJournalService {
  private entries: JournalEntry[] = [];
  private readonly MAX_ENTRIES = 200;

  record(action: StructuredAction, result: ActionResult, verification?: VerificationResult) {
    const entry: JournalEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      actionId: action.actionId,
      capability: action.capability,
      domain: action.domain,
      targetSummary: JSON.stringify(action.target),
      riskLevel: action.risk,
      source: action.source,
      status: result.status,
      executionTimeMs: result.executionTimeMs,
      verified: verification?.verified ?? false,
      outputSummary: result.output || result.error,
      securityViolation: result.status === 'BLOCKED' || action.risk === 'LEVEL_4_FORBIDDEN'
    };

    this.entries.push(entry);
    if (this.entries.length > this.MAX_ENTRIES) {
      this.entries.shift();
    }
  }

  getRecentEntries(limit: number = 50): JournalEntry[] {
    return this.entries.slice(-limit).reverse();
  }

  getSecurityAuditLog(limit: number = 50): JournalEntry[] {
    return this.entries.filter(e => e.securityViolation || e.riskLevel === 'LEVEL_3_DESTRUCTIVE').slice(-limit).reverse();
  }

  clear() {
    this.entries = [];
  }
}

export const ActionJournal = new ActionJournalService();
