/**
 * FloatGPT — Learning Engine: Pattern Mining, Preferences & Forgetting
 * 
 * Extracts workflow patterns from repetitive execution evidence,
 * learns scoped user preferences, resolves preference conflicts,
 * and enforces reversible "Forget that" rollback semantics.
 */

import { CandidateLearning, LearnedPreference, EvidenceRecord } from './types';
import { EvidenceEngine } from './evidenceEngine';

export class LearningEngine {
  private static workflowHistory: Map<string, number> = new Map(); // skillId -> runCount
  private static workflowEvidence: Map<string, string[]> = new Map(); // skillId -> evidenceIds
  private static candidates: Map<string, CandidateLearning> = new Map();
  private static preferences: Map<string, LearnedPreference> = new Map();

  private static readonly AUTOMATION_THRESHOLD = 5; // 5 repeated runs triggers recommendation

  /**
   * Tracks workflow executions and mines for recurring automation candidates.
   */
  static recordWorkflowExecution(skillId: string, parameters: Record<string, any> = {}): CandidateLearning | null {
    const currentCount = (this.workflowHistory.get(skillId) || 0) + 1;
    this.workflowHistory.set(skillId, currentCount);

    // Record structured evidence
    const ev = EvidenceEngine.record({
      source: 'WORKFLOW_RESULT',
      observationType: 'workflow_run',
      observation: { skillId, runCount: currentCount, parameters },
      confidence: 0.85
    });

    const evList = this.workflowEvidence.get(skillId) || [];
    evList.push(ev.evidenceId);
    this.workflowEvidence.set(skillId, evList);

    if (currentCount >= this.AUTOMATION_THRESHOLD) {
      const candidateId = `cand_wf_${skillId}`;
      const existing = this.candidates.get(candidateId);

      const confidence = Math.min(0.70 + (currentCount - this.AUTOMATION_THRESHOLD) * 0.05, 0.95);
      const candidate: CandidateLearning = {
        id: candidateId,
        type: 'WORKFLOW_PATTERN',
        key: skillId,
        value: { recommendedIntervalMinutes: 10080 }, // 1 week in minutes
        evidenceIds: [...evList],
        confidence,
        frequency: currentCount,
        status: 'CANDIDATE',
        proposedRecommendation: `You have run the "${skillId}" workflow ${currentCount} times recently. Would you like to schedule it automatically?`,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      this.candidates.set(candidateId, candidate);
      return candidate;
    }

    return null;
  }

  /**
   * Records or updates a learned preference.
   * Enforces Explicit vs Observed authority hierarchy and conflict detection.
   */
  static recordPreferenceChoice(
    key: string,
    value: any,
    source: 'USER_EXPLICIT' | 'OBSERVED',
    scope: string = 'PERSONAL'
  ): { updated: boolean; conflict?: boolean; message?: string } {
    const existing = this.preferences.get(key);

    // 1. Conflict Detection: Explicit preference exists, but observed behavior differs
    if (existing && existing.source === 'USER_EXPLICIT' && source === 'OBSERVED' && existing.value !== value) {
      return {
        updated: false,
        conflict: true,
        message: `Conflict detected: You recently selected "${value}", but your saved preference is "${existing.value}". Would you like to update your default?`
      };
    }

    // 2. Explicit preference always supersedes
    if (source === 'USER_EXPLICIT') {
      const pref: LearnedPreference = {
        key,
        value,
        scope,
        source: 'USER_EXPLICIT',
        confidence: 1.0,
        updatedAt: Date.now()
      };
      this.preferences.set(key, pref);

      EvidenceEngine.record({
        source: 'USER_EXPLICIT',
        observationType: 'preference_set',
        observation: { key, value, scope }
      });

      return { updated: true, message: `Explicit preference saved: ${key} = ${value}` };
    }

    // 3. Observed preference accumulation
    const newConfidence = existing ? Math.min(existing.confidence + 0.1, 0.90) : 0.60;
    const pref: LearnedPreference = {
      key,
      value,
      scope,
      source: 'OBSERVED',
      confidence: newConfidence,
      updatedAt: Date.now()
    };
    this.preferences.set(key, pref);

    EvidenceEngine.record({
      source: 'SYSTEM_OBSERVED',
      observationType: 'preference_observed',
      observation: { key, value, confidence: newConfidence }
    });

    return { updated: true };
  }

  static getPreference(key: string): LearnedPreference | null {
    return this.preferences.get(key) || null;
  }

  static getAllPreferences(): LearnedPreference[] {
    return Array.from(this.preferences.values());
  }

  static getCandidate(id: string): CandidateLearning | null {
    return this.candidates.get(id) || null;
  }

  static getAllCandidates(): CandidateLearning[] {
    return Array.from(this.candidates.values()).filter(c => c.status === 'CANDIDATE');
  }

  /**
   * Reversible Forgetting: Invalidates preference and rolls back any derived candidates.
   */
  static forgetPreference(key: string): boolean {
    const existed = this.preferences.delete(key);

    // Roll back derived candidates referencing this key
    for (const [candId, candidate] of this.candidates.entries()) {
      if (candidate.key === key) {
        candidate.status = 'INVALIDATED';
        candidate.updatedAt = Date.now();
        this.candidates.set(candId, candidate);
      }
    }

    if (existed) {
      EvidenceEngine.record({
        source: 'USER_EXPLICIT',
        observationType: 'preference_forgotten',
        observation: { key }
      });
    }

    return existed;
  }

  static clear(): void {
    this.workflowHistory.clear();
    this.workflowEvidence.clear();
    this.candidates.clear();
    this.preferences.clear();
  }
}
