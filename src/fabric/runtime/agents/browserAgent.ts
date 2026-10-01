/**
 * FloatGPT — Governed Browser Agent
 * 
 * Bounded agent for web interactions. Enforces protocol validation,
 * prompt injection quarantine, and dispatch via ActionBroker.
 */

import { AgentContract } from '../types';
import { ActionBroker } from '../../actionBroker';
import { StructuredAction, ActionResult } from '../../protocol';

export class BrowserAgent {
  static readonly contract: AgentContract = {
    agentId: 'agent.browser',
    name: 'Governed Browser Agent',
    description: 'Executes safe web navigation and queries under strict prompt injection quarantine.',
    allowedCapabilities: [
      'browser.navigate',
      'browser.search'
    ],
    maxSteps: 8,
    timeoutMs: 45000,
    requiresConfirmation: false
  };

  /**
   * Validates and normalizes web URLs.
   */
  static validateUrl(url: string): { valid: boolean; normalized: string; reason?: string } {
    if (!url || typeof url !== 'string') {
      return { valid: false, normalized: '', reason: 'URL cannot be empty.' };
    }

    const trimmed = url.trim();
    const blockedProtocols = ['javascript:', 'data:', 'file:', 'vbscript:', 'about:'];
    for (const proto of blockedProtocols) {
      if (trimmed.toLowerCase().startsWith(proto)) {
        return { valid: false, normalized: '', reason: `Blocked protocol: ${proto}. Only HTTP and HTTPS are permitted.` };
      }
    }

    let urlToParse = trimmed;
    if (!/^https?:\/\//i.test(urlToParse)) {
      urlToParse = `https://${urlToParse}`;
    }

    try {
      const parsed = new URL(urlToParse);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, normalized: '', reason: `Blocked protocol: ${parsed.protocol}. Only HTTP and HTTPS are permitted.` };
      }
      return { valid: true, normalized: parsed.toString() };
    } catch {
      return { valid: false, normalized: '', reason: 'Invalid URL structure.' };
    }
  }

  /**
   * Navigates to a URL safely.
   */
  static async navigate(
    url: string,
    options?: { source?: 'user_explicit' | 'agent_planner' | 'untrusted_external'; idempotencyKey?: string }
  ): Promise<ActionResult> {
    const check = this.validateUrl(url);
    if (!check.valid) {
      return {
        actionId: `act_browser_nav_${Date.now()}`,
        capability: 'browser.navigate',
        success: false,
        status: 'BLOCKED',
        error: check.reason,
        executionTimeMs: 0
      };
    }

    const source = options?.source || 'agent_planner';

    const action: StructuredAction = {
      actionId: `act_browser_nav_${Date.now()}`,
      capability: 'browser.navigate',
      domain: 'browser',
      target: { url: check.normalized },
      arguments: {},
      source,
      risk: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: false,
      description: `Navigate to URL: ${check.normalized}`,
      idempotencyKey: options?.idempotencyKey
    };

    return await ActionBroker.dispatch(action);
  }

  /**
   * Executes a web search query.
   */
  static async search(query: string, options?: { idempotencyKey?: string }): Promise<ActionResult> {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) {
      return {
        actionId: `act_browser_search_${Date.now()}`,
        capability: 'browser.search',
        success: false,
        status: 'BLOCKED',
        error: 'Search query cannot be empty.',
        executionTimeMs: 0
      };
    }

    const action: StructuredAction = {
      actionId: `act_browser_search_${Date.now()}`,
      capability: 'browser.search',
      domain: 'browser',
      target: { url: cleanQuery },
      arguments: { query: cleanQuery },
      source: 'agent_planner',
      risk: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: false,
      description: `Search web for: "${cleanQuery}"`,
      idempotencyKey: options?.idempotencyKey
    };

    return await ActionBroker.dispatch(action);
  }
}
