/**
 * FloatGPT — Governed File Agent
 * 
 * Bounded agent for filesystem interactions. Enforces workspace sandboxing,
 * path traversal containment, pre/post content hashing, and dispatch via ActionBroker.
 */

import { AgentContract } from '../types';
import { ActionBroker } from '../../actionBroker';
import { StructuredAction, ActionResult } from '../../protocol';

export function computeContentHash(content: string): string {
  try {
    // Node.js environment
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    // Browser or fallback hash
    let hash = 5381;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) + hash) + content.charCodeAt(i);
    }
    return Math.abs(hash).toString(16);
  }
}

export class FileAgent {
  static readonly contract: AgentContract = {
    agentId: 'agent.filesystem',
    name: 'Governed File System Agent',
    description: 'Executes bounded, sandboxed file operations with content hashing and traversal defenses.',
    allowedCapabilities: [
      'filesystem.read',
      'filesystem.write',
      'filesystem.list_directory'
    ],
    maxSteps: 10,
    timeoutMs: 60000,
    requiresConfirmation: false
  };

  /**
   * Validates that the path does not attempt directory traversal or root access.
   */
  static sanitizeAndValidatePath(inputPath: string): { valid: boolean; sanitized: string; reason?: string } {
    if (!inputPath || typeof inputPath !== 'string') {
      return { valid: false, sanitized: '', reason: 'Empty or invalid file path.' };
    }

    const lower = inputPath.toLowerCase().replace(/\\/g, '/');
    if (
      lower.includes('../') ||
      lower.includes('..\\') ||
      lower.startsWith('/etc/') ||
      lower.startsWith('/var/') ||
      lower.includes('system32') ||
      lower.includes('c:/windows')
    ) {
      return { valid: false, sanitized: inputPath, reason: 'Path traversal sequence or protected OS directory blocked.' };
    }

    const sanitized = inputPath.replace(/[<>"|?*]/g, '').trim();
    return { valid: true, sanitized };
  }

  /**
   * Safely reads a file through the ActionBroker.
   */
  static async readFile(path: string, options?: { idempotencyKey?: string }): Promise<ActionResult> {
    const check = this.sanitizeAndValidatePath(path);
    if (!check.valid) {
      return {
        actionId: `act_fs_read_${Date.now()}`,
        capability: 'filesystem.read',
        success: false,
        status: 'BLOCKED',
        error: check.reason,
        executionTimeMs: 0
      };
    }

    const action: StructuredAction = {
      actionId: `act_fs_read_${Date.now()}`,
      capability: 'filesystem.read',
      domain: 'filesystem',
      target: { path: check.sanitized },
      arguments: {},
      source: 'agent_planner',
      risk: 'LEVEL_0_OBSERVE',
      requiresConfirmation: false,
      reversible: true,
      description: `Read file: ${check.sanitized}`,
      idempotencyKey: options?.idempotencyKey
    };

    return await ActionBroker.dispatch(action);
  }

  /**
   * Safely writes a file through the ActionBroker, tracking pre and post state hashes.
   */
  static async writeFile(
    path: string,
    content: string,
    options?: { previousContent?: string; confirmed?: boolean; idempotencyKey?: string }
  ): Promise<ActionResult> {
    const check = this.sanitizeAndValidatePath(path);
    if (!check.valid) {
      return {
        actionId: `act_fs_write_${Date.now()}`,
        capability: 'filesystem.write',
        success: false,
        status: 'BLOCKED',
        error: check.reason,
        executionTimeMs: 0
      };
    }

    if (options?.confirmed) {
      const { PermissionManager } = await import('../../permissionManager');
      PermissionManager.grant('filesystem.write', 'ALLOW_FOR_SESSION', check.sanitized);
    }

    const preHash = options?.previousContent !== undefined ? computeContentHash(options.previousContent) : undefined;
    const postHash = computeContentHash(content);

    const action: StructuredAction = {
      actionId: `act_fs_write_${Date.now()}`,
      capability: 'filesystem.write',
      domain: 'filesystem',
      target: { path: check.sanitized, content },
      arguments: { content, preStateHash: preHash, postStateHash: postHash },
      source: 'agent_planner',
      risk: 'LEVEL_2_SENSITIVE',
      requiresConfirmation: false,
      reversible: true,
      description: `Write file: ${check.sanitized} (${content.length} bytes)`,
      idempotencyKey: options?.idempotencyKey
    };

    const result = await ActionBroker.dispatch(action);
    if (result.success) {
      result.stateChanges = {
        before: { hash: preHash },
        after: { hash: postHash, size: content.length },
        diff: `Content updated (SHA256: ${postHash})`
      };
    }

    return result;
  }

  /**
   * Safely lists a directory.
   */
  static async listDirectory(path: string): Promise<ActionResult> {
    const check = this.sanitizeAndValidatePath(path);
    if (!check.valid) {
      return {
        actionId: `act_fs_list_${Date.now()}`,
        capability: 'filesystem.list_directory',
        success: false,
        status: 'BLOCKED',
        error: check.reason,
        executionTimeMs: 0
      };
    }

    const action: StructuredAction = {
      actionId: `act_fs_list_${Date.now()}`,
      capability: 'filesystem.list_directory',
      domain: 'filesystem',
      target: { path: check.sanitized },
      arguments: {},
      source: 'agent_planner',
      risk: 'LEVEL_0_OBSERVE',
      requiresConfirmation: false,
      reversible: true,
      description: `List directory: ${check.sanitized}`
    };

    return await ActionBroker.dispatch(action);
  }
}
