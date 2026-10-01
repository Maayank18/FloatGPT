/**
 * FloatGPT — Memory Promotion Bridge
 * 
 * Manages the controlled, auditable promotion of personal learnings,
 * decisions, and context into shared team/workspace knowledge.
 */

import { PromotedMemoryRecord, UserRole } from './types';
import { RBACEngine } from './rbacEngine';
import { AuditLogger } from '../audit/auditLogger';

export class MemoryPromotionBridge {
  private static promotedRecords: Map<string, PromotedMemoryRecord> = new Map();

  /**
   * Promotes a personal memory to workspace-level knowledge.
   * Requires promotion authorization and emits a tamper-evident audit record.
   */
  static promote(params: {
    userId: string;
    userRole: UserRole;
    tenantId: string;
    targetWorkspaceId: string;
    sourceMemoryId: string;
    content: string;
    rationale: string;
  }): PromotedMemoryRecord {
    // 1. RBAC evaluation for promotion authority
    const auth = RBACEngine.authorize(
      {
        userId: params.userId,
        tenantId: params.tenantId,
        role: params.userRole,
        workspaceId: params.targetWorkspaceId
      },
      'promote',
      {
        id: params.sourceMemoryId,
        tenantId: params.tenantId,
        workspaceId: params.targetWorkspaceId,
        scope: 'PERSONAL',
        classification: 'INTERNAL',
        ownerId: params.userId
      }
    );

    if (!auth.authorized) {
      throw new Error(`Memory promotion denied: ${auth.reason}`);
    }

    const id = `prom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: PromotedMemoryRecord = {
      id,
      sourceMemoryId: params.sourceMemoryId,
      promotedBy: params.userId,
      tenantId: params.tenantId,
      workspaceId: params.targetWorkspaceId,
      content: params.content,
      rationale: params.rationale,
      timestamp: Date.now()
    };

    this.promotedRecords.set(id, record);

    // 2. Audit Trail
    AuditLogger.log({
      actorId: params.userId,
      tenantId: params.tenantId,
      workspaceId: params.targetWorkspaceId,
      action: 'MEMORY_PROMOTED',
      resourceId: id,
      details: {
        sourceMemoryId: params.sourceMemoryId,
        rationale: params.rationale,
        promotedContentSnippet: params.content.substring(0, 100)
      }
    });

    return record;
  }

  static get(id: string): PromotedMemoryRecord | null {
    return this.promotedRecords.get(id) || null;
  }

  static listByWorkspace(workspaceId: string): PromotedMemoryRecord[] {
    return Array.from(this.promotedRecords.values()).filter(r => r.workspaceId === workspaceId);
  }

  static clear(): void {
    this.promotedRecords.clear();
  }
}
