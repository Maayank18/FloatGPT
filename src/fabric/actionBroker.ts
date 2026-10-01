/**
 * FloatGPT — Central Action Broker
 * 
 * The authoritative security and execution boundary of FloatGPT.
 * All external actions (OS, browser, filesystem, window, clipboard) must pass
 * through this gateway.
 */

import { StructuredAction, ActionResult } from './protocol';
import { CapabilityRegistry } from './registry';
import { RiskEngine } from './riskEngine';
import { PolicyEngine } from './policyEngine';
import { PermissionManager } from './permissionManager';
import { KillSwitch } from './killSwitch';
import { VerificationEngine } from './verifier';
import { RecoveryEngine } from './recovery';
import { ActionJournal } from './journal';
import { ContextGraph } from './contextGraph';

import { IExecutionAdapter } from './adapters/types';
import { WindowsAdapter } from './adapters/windowsAdapter';
import { MacAdapter } from './adapters/macAdapter';
import { BrowserAdapter } from './adapters/browserAdapter';
import { FileAdapter } from './adapters/fileAdapter';
import { ClipboardAdapter } from './adapters/clipboardAdapter';
import { SystemAdapter } from './adapters/systemAdapter';
import { DocumentAdapter } from './adapters/documentAdapter';
import { ShareAdapter } from './adapters/shareAdapter';
import { MessengerExecutionAdapter } from './adapters/messengerAdapter';

import { detectPlatform } from '../platform';

export class ActionBroker {
  private static adapters: IExecutionAdapter[] = [
    new WindowsAdapter(),
    new MacAdapter(),
    new BrowserAdapter(),
    new FileAdapter(),
    new ClipboardAdapter(),
    new SystemAdapter(),
    new DocumentAdapter(),
    new ShareAdapter(),
    new MessengerExecutionAdapter()
  ];

  private static activeLocks: Set<string> = new Set();

  /**
   * Main entry point to execute any structured action.
   */
  static async dispatch(action: StructuredAction): Promise<ActionResult> {
    const startTime = Date.now();

    // ─── 1. Check Global Emergency Kill Switch ──────────────────
    if (KillSwitch.isHalted()) {
      const blockedResult: ActionResult = {
        actionId: action.actionId,
        capability: action.capability,
        success: false,
        status: 'BLOCKED',
        error: 'Execution halted by Global Emergency Kill Switch.',
        executionTimeMs: Date.now() - startTime
      };
      ActionJournal.record(action, blockedResult);
      return blockedResult;
    }

    // ─── 2. Capability Validation ───────────────────────────────
    const capability = CapabilityRegistry.get(action.capability);
    if (!capability) {
      const unknownResult: ActionResult = {
        actionId: action.actionId,
        capability: action.capability,
        success: false,
        status: 'BLOCKED',
        error: `Capability "${action.capability}" is not registered in the Capability Catalog.`,
        executionTimeMs: Date.now() - startTime
      };
      ActionJournal.record(action, unknownResult);
      return unknownResult;
    }

    // ─── 3. Risk Engine Classification ──────────────────────────
    const riskEval = RiskEngine.evaluate(action);
    action.risk = riskEval.riskLevel;

    if (riskEval.blocked) {
      const blockedResult: ActionResult = {
        actionId: action.actionId,
        capability: action.capability,
        success: false,
        status: 'BLOCKED',
        error: `🛡️ Security Violation: ${riskEval.category} (${riskEval.reason})`,
        executionTimeMs: Date.now() - startTime
      };
      ActionJournal.record(action, blockedResult);
      return blockedResult;
    }

    // ─── 4. Policy Engine Evaluation ────────────────────────────
    const policyResult = PolicyEngine.evaluate(action);
    if (!policyResult.allowed) {
      const policyBlocked: ActionResult = {
        actionId: action.actionId,
        capability: action.capability,
        success: false,
        status: 'BLOCKED',
        error: `🛡️ Policy Rejection: ${policyResult.policyName} (${policyResult.reason})`,
        executionTimeMs: Date.now() - startTime
      };
      ActionJournal.record(action, policyBlocked);
      return policyBlocked;
    }

    if (policyResult.downgradeToConfirmation) {
      action.requiresConfirmation = true;
    }

    // ─── 5. Permission Gate ─────────────────────────────────────
    const permCheck = PermissionManager.checkPermission(action);
    const requiresUserConfirmation = !permCheck.granted || action.requiresConfirmation || (capability.requiresConfirmation && !permCheck.scope);
    if (requiresUserConfirmation) {
      // Returns a confirmation-required card payload
      const confirmationPayload = JSON.stringify({
        actionId: action.actionId,
        capability: action.capability,
        description: action.description,
        target: action.target,
        risk: action.risk
      });

      return {
        actionId: action.actionId,
        capability: action.capability,
        success: false,
        status: 'AUTHORIZED', // Waiting for explicit user confirmation
        output: `<!-- SECURITY_PROMPT_CARD: ${confirmationPayload} -->`,
        executionTimeMs: Date.now() - startTime
      };
    }

    // ─── 6. Resource Lock / Concurrency Control ─────────────────
    const lockKey = action.target.path || action.target.application || action.capability;
    if (this.activeLocks.has(lockKey)) {
      return {
        actionId: action.actionId,
        capability: action.capability,
        success: false,
        status: 'FAILED',
        error: `Resource lock collision on "${lockKey}". Another operation is currently in progress.`,
        executionTimeMs: Date.now() - startTime
      };
    }
    this.activeLocks.add(lockKey);

    // ─── 7. Resolve Trusted Adapter ─────────────────────────────
    const adapter = await this.resolveAdapter(action);
    if (!adapter) {
      this.activeLocks.delete(lockKey);
      const noAdapterResult: ActionResult = {
        actionId: action.actionId,
        capability: action.capability,
        success: false,
        status: 'FAILED',
        error: `No compatible execution adapter found for capability "${action.capability}".`,
        executionTimeMs: Date.now() - startTime
      };
      ActionJournal.record(action, noAdapterResult);
      return noAdapterResult;
    }

    // ─── 8. Execute through Trusted Adapter ─────────────────────
    let result: ActionResult;
    try {
      result = await adapter.execute(action);
    } catch (err: any) {
      result = {
        actionId: action.actionId,
        capability: action.capability,
        success: false,
        status: 'FAILED',
        error: err.message || 'Adapter execution threw an unhandled error.',
        executionTimeMs: Date.now() - startTime
      };
    } finally {
      this.activeLocks.delete(lockKey);
    }

    // ─── 9. Post-Execution Verification ─────────────────────────
    const verification = await VerificationEngine.verify(action, result, adapter);
    result.verified = verification.verified;
    result.verificationDetails = verification.observedState;

    // ─── 10. Failure Recovery Assessment ────────────────────────
    if (!result.success) {
      const recoveryPlan = RecoveryEngine.planRecovery(action, result);
      if (recoveryPlan.strategy === 'RETRY' && recoveryPlan.maxRetriesAllowed > 0) {
        try {
          result = await adapter.execute(action);
          const secondVerification = await VerificationEngine.verify(action, result, adapter);
          result.verified = secondVerification.verified;
        } catch {}
      }
    }

    // ─── 11. Journaling & Context Graph Update ──────────────────
    ActionJournal.record(action, result, verification);
    if (result.success) {
      ContextGraph.recordAction(action.description);
    }

    return result;
  }

  private static async resolveAdapter(action: StructuredAction): Promise<IExecutionAdapter | null> {
    const isMac = detectPlatform() === 'darwin';

    for (const adapter of this.adapters) {
      if (action.domain === 'browser' && adapter.id === 'browser_adapter') return adapter;
      if (action.domain === 'filesystem' && adapter.id === 'file_adapter') return adapter;
      if (action.domain === 'clipboard' && adapter.id === 'clipboard_adapter') return adapter;
      if (action.domain === 'system' && adapter.id === 'system_adapter') return adapter;
      if (action.domain === 'document' && adapter.id === 'document_adapter') return adapter;
      if (action.domain === 'share' && adapter.id === 'share_adapter') return adapter;
      if (action.domain === 'messaging' && adapter.id === 'messenger_adapter') return adapter;

      if (action.domain === 'application') {
        if (isMac && adapter.id === 'macos_native_adapter') return adapter;
        if (!isMac && adapter.id === 'windows_native_adapter') return adapter;
      }
    }

    return null;
  }
}
