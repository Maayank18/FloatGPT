/**
 * FloatGPT — Permission Manager & Memory
 * 
 * Manages fine-grained, scoped permissions per capability, application, and session.
 * Prevents broad, global authority and remembers user preferences safely.
 */

import { PermissionScope, StructuredAction } from './protocol';

export class PermissionManager {
  private static permissions: Map<string, PermissionScope> = new Map();

  private static buildKey(capability: string, target?: string): string {
    return target ? `${capability}::${target.toLowerCase().trim()}` : capability;
  }

  /**
   * Checks if an action is permitted by existing user grants.
   */
  static checkPermission(action: StructuredAction): { granted: boolean; scope?: PermissionScope } {
    const specificKey = this.buildKey(action.capability, action.target.application || action.target.domain || action.target.path);
    const globalKey = action.capability;

    const specificScope = this.permissions.get(specificKey);
    if (specificScope) {
      if (specificScope.expiresAt && Date.now() > specificScope.expiresAt) {
        this.permissions.delete(specificKey);
      } else {
        return { granted: specificScope.scopeType !== 'DENY', scope: specificScope };
      }
    }

    const globalScope = this.permissions.get(globalKey);
    if (globalScope) {
      if (globalScope.expiresAt && Date.now() > globalScope.expiresAt) {
        this.permissions.delete(globalKey);
      } else {
        return { granted: globalScope.scopeType !== 'DENY', scope: globalScope };
      }
    }

    // Default: If the action is Level 0 or Level 1 and does not explicitly require confirmation, granted by default.
    const isAutoAllowed = action.risk === 'LEVEL_0_OBSERVE' || (action.risk === 'LEVEL_1_LOW_RISK' && !action.requiresConfirmation);
    return { granted: isAutoAllowed };
  }

  /**
   * Grants or updates a scoped permission.
   */
  static grant(
    capability: string,
    scopeType: PermissionScope['scopeType'],
    target?: string,
    durationMs?: number
  ): PermissionScope {
    const key = this.buildKey(capability, target);
    const scope: PermissionScope = {
      id: Math.random().toString(36).substring(2, 9),
      capability,
      target,
      scopeType,
      grantedAt: Date.now(),
      expiresAt: durationMs ? Date.now() + durationMs : undefined
    };

    this.permissions.set(key, scope);
    return scope;
  }

  /**
   * Revokes all session-scoped permissions.
   */
  static clearSessionGrants() {
    for (const [key, scope] of this.permissions.entries()) {
      if (scope.scopeType === 'ALLOW_FOR_SESSION' || scope.scopeType === 'ALLOW_FOR_WORKFLOW') {
        this.permissions.delete(key);
      }
    }
  }
}
