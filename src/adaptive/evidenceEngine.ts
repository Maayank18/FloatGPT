/**
 * FloatGPT — Structured Evidence Engine
 * 
 * Captures, indexes, and evaluates observations across user actions,
 * workflow outcomes, and system events. Enforces a strict trust hierarchy.
 */

import { EvidenceRecord, EvidenceSource } from './types';

export const TRUST_HIERARCHY: Record<EvidenceSource, { authorityRank: number; defaultConfidence: number; canAuthorize: boolean }> = {
  USER_EXPLICIT:     { authorityRank: 7, defaultConfidence: 1.0,  canAuthorize: true },
  USER_CONFIRMED:    { authorityRank: 6, defaultConfidence: 0.95, canAuthorize: true },
  WORKFLOW_RESULT:   { authorityRank: 5, defaultConfidence: 0.85, canAuthorize: false },
  SYSTEM_OBSERVED:   { authorityRank: 4, defaultConfidence: 0.75, canAuthorize: false },
  DERIVED:           { authorityRank: 3, defaultConfidence: 0.60, canAuthorize: false },
  MODEL_INFERENCE:   { authorityRank: 2, defaultConfidence: 0.40, canAuthorize: false },
  EXTERNAL_CONTENT:  { authorityRank: 1, defaultConfidence: 0.10, canAuthorize: false }
};

export class EvidenceEngine {
  private static records: Map<string, EvidenceRecord> = new Map();

  /**
   * Records an observation into the evidence index.
   */
  static record(params: {
    source: EvidenceSource;
    observationType: string;
    observation: Record<string, any>;
    sourceReference?: string;
    confidence?: number;
    scope?: 'PERSONAL' | 'WORKSPACE' | 'THREAD';
    expiration?: number;
  }): EvidenceRecord {
    const evidenceId = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const trust = TRUST_HIERARCHY[params.source];
    const confidence = params.confidence !== undefined ? params.confidence : trust.defaultConfidence;

    const record: EvidenceRecord = {
      evidenceId,
      source: params.source,
      sourceReference: params.sourceReference,
      observationType: params.observationType,
      observation: params.observation,
      confidence,
      timestamp: Date.now(),
      scope: params.scope || 'WORKSPACE',
      expiration: params.expiration
    };

    this.records.set(evidenceId, record);
    return record;
  }

  static get(evidenceId: string): EvidenceRecord | null {
    return this.records.get(evidenceId) || null;
  }

  static query(filter?: {
    source?: EvidenceSource;
    observationType?: string;
    minConfidence?: number;
  }): EvidenceRecord[] {
    const list = Array.from(this.records.values());
    return list.filter(e => {
      if (filter?.source && e.source !== filter.source) return false;
      if (filter?.observationType && e.observationType !== filter.observationType) return false;
      if (filter?.minConfidence !== undefined && e.confidence < filter.minConfidence) return false;
      if (e.expiration && Date.now() > e.expiration) return false;
      return true;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Evaluates if a given evidence source has authority to establish security or execution policies.
   * Only USER_EXPLICIT and USER_CONFIRMED sources have authority.
   */
  static hasAuthority(source: EvidenceSource): boolean {
    return TRUST_HIERARCHY[source].canAuthorize;
  }

  /**
   * Compares the relative authority rank of two sources.
   * Returns positive if sourceA > sourceB, negative if sourceA < sourceB.
   */
  static compareAuthority(sourceA: EvidenceSource, sourceB: EvidenceSource): number {
    return TRUST_HIERARCHY[sourceA].authorityRank - TRUST_HIERARCHY[sourceB].authorityRank;
  }

  static clear(): void {
    this.records.clear();
  }
}
