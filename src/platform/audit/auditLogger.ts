/**
 * FloatGPT — Tamper-Evident Enterprise Audit Logger
 * 
 * Cryptographically links all enterprise audit records using SHA-256 hash chains.
 * Detects any mutation, tampering, or deletion across historical logs.
 */

import { sha256Hex } from '../cryptoUtils';
import { AuditRecord, AuditAction, AuditVerificationResult } from './types';

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export class AuditLogger {
  private static records: AuditRecord[] = [];
  private static lastHash: string = GENESIS_HASH;

  /**
   * Logs an audit record and links it to the preceding cryptographic hash.
   */
  static log(params: {
    actorId: string;
    tenantId: string;
    workspaceId?: string;
    action: AuditAction;
    resourceId: string;
    details?: Record<string, any>;
  }): AuditRecord {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = Date.now();
    const details = params.details || {};
    const previousHash = this.lastHash;

    const payload = JSON.stringify({
      id,
      timestamp,
      actorId: params.actorId,
      tenantId: params.tenantId,
      workspaceId: params.workspaceId,
      action: params.action,
      resourceId: params.resourceId,
      details,
      previousHash
    });

    const currentHash = sha256Hex(payload);

    const record: AuditRecord = {
      id,
      timestamp,
      actorId: params.actorId,
      tenantId: params.tenantId,
      workspaceId: params.workspaceId,
      action: params.action,
      resourceId: params.resourceId,
      details,
      previousHash,
      currentHash
    };

    this.records.push(record);
    this.lastHash = currentHash;
    return record;
  }

  /**
   * Cryptographically verifies the integrity of the entire audit chain.
   */
  static verifyChain(): AuditVerificationResult {
    if (this.records.length === 0) {
      return { valid: true, recordCount: 0 };
    }

    let expectedPrevHash = GENESIS_HASH;

    for (let i = 0; i < this.records.length; i++) {
      const rec = this.records[i];

      // 1. Verify previous hash link
      if (rec.previousHash !== expectedPrevHash) {
        return {
          valid: false,
          tamperedRecordId: rec.id,
          recordCount: this.records.length,
          reason: `Broken chain link at index ${i}. Expected previous hash "${expectedPrevHash}", but found "${rec.previousHash}".`
        };
      }

      // 2. Recalculate hash from stored content
      const payload = JSON.stringify({
        id: rec.id,
        timestamp: rec.timestamp,
        actorId: rec.actorId,
        tenantId: rec.tenantId,
        workspaceId: rec.workspaceId,
        action: rec.action,
        resourceId: rec.resourceId,
        details: rec.details,
        previousHash: rec.previousHash
      });

      const calculatedHash = sha256Hex(payload);
      if (calculatedHash !== rec.currentHash) {
        return {
          valid: false,
          tamperedRecordId: rec.id,
          recordCount: this.records.length,
          reason: `Payload tampering detected in record "${rec.id}". Hash mismatch.`
        };
      }

      expectedPrevHash = rec.currentHash;
    }

    return { valid: true, recordCount: this.records.length };
  }

  static query(filter?: {
    tenantId?: string;
    workspaceId?: string;
    action?: AuditAction;
    actorId?: string;
  }): AuditRecord[] {
    return this.records.filter(r => {
      if (filter?.tenantId && r.tenantId !== filter.tenantId) return false;
      if (filter?.workspaceId && r.workspaceId !== filter.workspaceId) return false;
      if (filter?.action && r.action !== filter.action) return false;
      if (filter?.actorId && r.actorId !== filter.actorId) return false;
      return true;
    });
  }

  static getRawRecords(): AuditRecord[] {
    return this.records;
  }

  static clear(): void {
    this.records = [];
    this.lastHash = GENESIS_HASH;
  }
}
