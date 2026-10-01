/**
 * FloatGPT — Role-Based Access Control & Personal Data Firewall
 * 
 * Enforces multi-tenant isolation, role boundaries, and the strict
 * Personal Data Firewall preventing private memories from leaking into team memory.
 */

import {
  AuthorizationSubject,
  AuthorizationResource,
  AuthorizationResult,
  ActionType,
  UserRole,
  DataClassification
} from './types';

const ROLE_RANKS: Record<UserRole, number> = {
  GUEST: 1,
  VIEWER: 2,
  MEMBER: 3,
  DEVELOPER: 4,
  MANAGER: 5,
  ADMIN: 6,
  OWNER: 7
};

export class RBACEngine {
  /**
   * Evaluates the authorization tuple: (Subject, Action, Resource, Scope, Classification)
   */
  static authorize(
    subject: AuthorizationSubject,
    action: ActionType,
    resource: AuthorizationResource
  ): AuthorizationResult {
    // 1. Strict Multi-Tenant Isolation
    if (subject.tenantId !== resource.tenantId) {
      return {
        authorized: false,
        reason: `Cross-tenant access strictly denied. Subject tenant (${subject.tenantId}) does not match resource tenant (${resource.tenantId}).`
      };
    }

    // 2. Personal Data Firewall
    if (resource.scope === 'PERSONAL') {
      if (resource.ownerId && resource.ownerId !== subject.userId) {
        return {
          authorized: false,
          reason: 'Personal Data Firewall violation: Personal memories, threads, and preferences can only be accessed by their owner.'
        };
      }
      return { authorized: true, reason: 'Personal owner access granted.' };
    }

    // 3. Workspace Membership Check
    if (resource.scope === 'WORKSPACE' && resource.workspaceId) {
      const isTenantAdmin = subject.role === 'ADMIN' || subject.role === 'OWNER';
      const isWorkspaceMember = subject.workspaceId === resource.workspaceId;
      if (!isWorkspaceMember && !isTenantAdmin) {
        return {
          authorized: false,
          reason: `Access denied: Subject is not a member of workspace "${resource.workspaceId}".`
        };
      }
    }

    // 4. Data Classification Enforcement
    if (resource.classification === 'RESTRICTED') {
      if (ROLE_RANKS[subject.role] < ROLE_RANKS.ADMIN) {
        return {
          authorized: false,
          reason: 'Access denied: RESTRICTED data requires ADMIN or OWNER role.',
          requiredRole: 'ADMIN'
        };
      }
    } else if (resource.classification === 'CONFIDENTIAL') {
      if (ROLE_RANKS[subject.role] < ROLE_RANKS.MEMBER) {
        return {
          authorized: false,
          reason: 'Access denied: CONFIDENTIAL data cannot be accessed by VIEWER or GUEST roles.',
          requiredRole: 'MEMBER'
        };
      }
    }

    // 5. Action Role Boundaries
    switch (action) {
      case 'read':
        // If passed classification checks, read is authorized
        return { authorized: true, reason: 'Read permission granted.' };

      case 'write':
        if (ROLE_RANKS[subject.role] < ROLE_RANKS.MEMBER) {
          return {
            authorized: false,
            reason: `Write permission denied for role "${subject.role}". Minimum MEMBER role required.`,
            requiredRole: 'MEMBER'
          };
        }
        return { authorized: true, reason: 'Write permission granted.' };

      case 'delete':
        if (ROLE_RANKS[subject.role] < ROLE_RANKS.MANAGER && resource.ownerId !== subject.userId) {
          return {
            authorized: false,
            reason: `Delete permission denied for role "${subject.role}". Minimum MANAGER role required.`,
            requiredRole: 'MANAGER'
          };
        }
        return { authorized: true, reason: 'Delete permission granted.' };

      case 'execute':
        if (ROLE_RANKS[subject.role] < ROLE_RANKS.MEMBER) {
          return {
            authorized: false,
            reason: `Workflow execution denied for role "${subject.role}". Minimum MEMBER role required.`,
            requiredRole: 'MEMBER'
          };
        }
        return { authorized: true, reason: 'Execution permission granted.' };

      case 'promote':
        if (ROLE_RANKS[subject.role] < ROLE_RANKS.MEMBER) {
          return {
            authorized: false,
            reason: `Memory promotion denied for role "${subject.role}". Minimum MEMBER role required.`,
            requiredRole: 'MEMBER'
          };
        }
        return { authorized: true, reason: 'Promotion permission granted.' };

      case 'admin':
        if (ROLE_RANKS[subject.role] < ROLE_RANKS.ADMIN) {
          return {
            authorized: false,
            reason: `Administrative operation denied for role "${subject.role}". Minimum ADMIN role required.`,
            requiredRole: 'ADMIN'
          };
        }
        return { authorized: true, reason: 'Admin permission granted.' };

      default:
        return { authorized: false, reason: `Unknown action "${action}".` };
    }
  }

  /**
   * Personal Data Firewall Query Filter.
   * Strips personal memory records from team or workspace query results.
   */
  static applyDataFirewall<T extends { scope: string; ownerId?: string }>(
    records: T[],
    currentUserId: string,
    targetQueryScope: 'PERSONAL' | 'TEAM' | 'WORKSPACE' | 'ORGANIZATION'
  ): T[] {
    return records.filter(r => {
      // If querying personal scope, only return own personal items
      if (targetQueryScope === 'PERSONAL') {
        return r.scope === 'PERSONAL' && r.ownerId === currentUserId;
      }
      // If querying team/workspace/org, STRICTLY exclude personal items
      return r.scope !== 'PERSONAL';
    });
  }
}
