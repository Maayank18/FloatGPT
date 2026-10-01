/**
 * FloatGPT — Tenant & Workspace Manager
 * 
 * Manages tenant boundaries, workspaces, team rosters, and member roles.
 */

import { Tenant, Workspace, Team, PlatformUser, UserRole } from './types';

export class TenantManager {
  private static tenants: Map<string, Tenant> = new Map();
  private static workspaces: Map<string, Workspace> = new Map();
  private static teams: Map<string, Team> = new Map();
  private static users: Map<string, PlatformUser> = new Map();

  // 1. Tenants
  static createTenant(name: string, domain?: string): Tenant {
    const id = `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const tenant: Tenant = {
      id,
      name,
      domain,
      createdAt: Date.now(),
      status: 'ACTIVE'
    };
    this.tenants.set(id, tenant);
    return tenant;
  }

  static getTenant(id: string): Tenant | null {
    return this.tenants.get(id) || null;
  }

  // 2. Workspaces
  static createWorkspace(tenantId: string, name: string): Workspace {
    if (!this.tenants.has(tenantId)) {
      throw new Error(`Cannot create workspace: Tenant "${tenantId}" does not exist.`);
    }
    const id = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const ws: Workspace = {
      id,
      tenantId,
      name,
      createdAt: Date.now()
    };
    this.workspaces.set(id, ws);
    return ws;
  }

  static getWorkspace(id: string): Workspace | null {
    return this.workspaces.get(id) || null;
  }

  static listWorkspaces(tenantId: string): Workspace[] {
    return Array.from(this.workspaces.values()).filter(w => w.tenantId === tenantId);
  }

  // 3. Teams
  static createTeam(workspaceId: string, name: string, memberIds: string[] = []): Team {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) {
      throw new Error(`Cannot create team: Workspace "${workspaceId}" does not exist.`);
    }
    const id = `team_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const team: Team = {
      id,
      workspaceId,
      name,
      memberIds,
      createdAt: Date.now()
    };
    this.teams.set(id, team);
    return team;
  }

  static getTeam(id: string): Team | null {
    return this.teams.get(id) || null;
  }

  // 4. Users & Membership
  static registerUser(params: {
    tenantId: string;
    email: string;
    name: string;
    role: UserRole;
    workspaceIds?: string[];
    teamIds?: string[];
  }): PlatformUser {
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const user: PlatformUser = {
      id,
      tenantId: params.tenantId,
      email: params.email,
      name: params.name,
      role: params.role,
      workspaceIds: params.workspaceIds || [],
      teamIds: params.teamIds || [],
      createdAt: Date.now()
    };
    this.users.set(id, user);
    return user;
  }

  static getUser(id: string): PlatformUser | null {
    return this.users.get(id) || null;
  }

  static setUserRole(userId: string, newRole: UserRole): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.role = newRole;
    this.users.set(userId, user);
    return true;
  }

  static clear(): void {
    this.tenants.clear();
    this.workspaces.clear();
    this.teams.clear();
    this.users.clear();
  }
}
