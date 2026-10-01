/**
 * FloatGPT — Enterprise Audit Logging Types
 * 
 * Defines schemas for tamper-evident, cryptographically chained audit events.
 */

export type AuditAction = 
  | 'AUTH_SUCCESS'
  | 'AUTH_DENIED'
  | 'MEMORY_PROMOTED'
  | 'WORKFLOW_STARTED'
  | 'WORKFLOW_COMPLETED'
  | 'POLICY_VIOLATION'
  | 'WEBHOOK_RECEIVED'
  | 'CONFIG_CHANGED';

export interface AuditRecord {
  id: string;
  timestamp: number;
  actorId: string;
  tenantId: string;
  workspaceId?: string;
  action: AuditAction;
  resourceId: string;
  details: Record<string, any>;
  previousHash: string;
  currentHash: string;
}

export interface AuditVerificationResult {
  valid: boolean;
  tamperedRecordId?: string;
  recordCount: number;
  reason?: string;
}
