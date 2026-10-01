/**
 * FloatGPT — Enterprise Platform & Tenancy Types
 * 
 * Defines schemas for Multi-Tenant Isolation, RBAC Roles,
 * Data Classifications, Scopes, and Controlled Memory Promotion.
 */

export type UserRole = 
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'MEMBER'
  | 'VIEWER'
  | 'GUEST'
  | 'DEVELOPER';

export type DataClassification = 
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'RESTRICTED';

export type ResourceScope = 
  | 'PERSONAL'
  | 'TEAM'
  | 'WORKSPACE'
  | 'ORGANIZATION';

export type ActionType = 
  | 'read'
  | 'write'
  | 'delete'
  | 'execute'
  | 'admin'
  | 'promote';

export interface Tenant {
  id: string;
  name: string;
  domain?: string;
  createdAt: number;
  status: 'ACTIVE' | 'SUSPENDED';
}

export interface Workspace {
  id: string;
  tenantId: string;
  name: string;
  createdAt: number;
}

export interface Team {
  id: string;
  workspaceId: string;
  name: string;
  memberIds: string[];
  createdAt: number;
}

export interface PlatformUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  workspaceIds: string[];
  teamIds: string[];
  createdAt: number;
}

export interface AuthorizationSubject {
  userId: string;
  tenantId: string;
  role: UserRole;
  workspaceId?: string;
  teamIds?: string[];
}

export interface AuthorizationResource {
  id: string;
  tenantId: string;
  workspaceId?: string;
  scope: ResourceScope;
  classification: DataClassification;
  ownerId?: string;
}

export interface AuthorizationResult {
  authorized: boolean;
  reason: string;
  requiredRole?: UserRole;
}

export interface PromotedMemoryRecord {
  id: string;
  sourceMemoryId: string;
  promotedBy: string;
  tenantId: string;
  workspaceId: string;
  content: string;
  rationale: string;
  timestamp: number;
}
