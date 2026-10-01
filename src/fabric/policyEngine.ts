/**
 * FloatGPT — Policy Engine
 * 
 * Enforces domain-aware safety policies, untrusted prompt injection guards,
 * and filesystem path traversal defenses.
 */

import { StructuredAction } from './protocol';
import { ActionJournal } from './journal';

export interface PolicyCheckResult {
  allowed: boolean;
  policyName: string;
  reason?: string;
  downgradeToConfirmation?: boolean;
}

const SENSITIVE_DOMAINS = [
  'bank', 'chase.com', 'bankofamerica.com', 'wellsfargo.com', 'paypal.com',
  'login', 'signin', 'auth', 'accounts.google.com', 'github.com/login',
  '1password.com', 'bitwarden.com', 'lastpass.com', 'stripe.com'
];

export class PolicyEngine {
  /**
   * Evaluates domain, path, and prompt policies against the proposed action.
   */
  static evaluate(action: StructuredAction): PolicyCheckResult {
    // 1. Filesystem Path Traversal Policy
    if (action.domain === 'filesystem' && action.target.path) {
      const p = action.target.path.toLowerCase();
      // Block relative path traversal attempts to access system directories
      if (
        p.includes('..') ||
        p.includes('/etc/') ||
        p.includes('/var/') ||
        p.includes('c:\\windows') ||
        p.includes('c:\\program files') ||
        p.includes('system32')
      ) {
        return {
          allowed: false,
          policyName: 'Filesystem Sandbox Policy',
          reason: 'Access to system root or path traversal sequences is blocked.'
        };
      }
    }

    // 2. Sensitive Web Domain Policy
    if (action.domain === 'browser' && action.target.url) {
      const url = action.target.url.toLowerCase();
      const isSensitive = SENSITIVE_DOMAINS.some(d => url.includes(d));
      if (isSensitive && action.source === 'untrusted_external') {
        return {
          allowed: false,
          policyName: 'Sensitive Domain Isolation Policy',
          reason: 'Untrusted content cannot automatically navigate or interact with authentication or banking portals.'
        };
      }
    }

    // 3. Prompt Injection / Untrusted External Content Boundary
    if (action.source === 'untrusted_external' && (action.risk === 'LEVEL_2_SENSITIVE' || action.risk === 'LEVEL_3_DESTRUCTIVE')) {
      return {
        allowed: true,
        policyName: 'Untrusted Source Quarantine Policy',
        downgradeToConfirmation: true,
        reason: 'Action was suggested by external webpage/document data. User confirmation is strictly required.'
      };
    }

    // 4. Anti-Exfiltration Policy
    // If a recent action read local files and the current action transmits data externally (network/browser/messaging/share),
    // require explicit human confirmation.
    const isExternalTransmission = 
      (action.domain === 'browser' && (action.target.url?.includes('?') || Boolean(action.arguments?.payload || action.arguments?.data))) ||
      action.domain === 'messaging' ||
      action.domain === 'share' ||
      action.capability === 'network.send' ||
      action.capability === 'share.export';

    if (isExternalTransmission) {
      const recent = ActionJournal.getRecentEntries(10);
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const recentFileRead = recent.some(
        (e: any) => (e.domain === 'filesystem' || e.capability?.startsWith('filesystem.read')) && e.timestamp > fiveMinutesAgo
      );

      if (recentFileRead) {
        return {
          allowed: true,
          policyName: 'Anti-Exfiltration Policy',
          downgradeToConfirmation: true,
          reason: 'Anti-Exfiltration Defense: Local filesystem was recently accessed and external transmission is requested. Human confirmation required.'
        };
      }
    }

    return {
      allowed: true,
      policyName: 'Default Permissive Policy'
    };
  }
}

