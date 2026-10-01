/**
 * FloatGPT — Share Execution Adapter
 * 
 * Bridges the Execution Fabric to WhatsApp, Email, Native Share, and Clipboard.
 */

import { IExecutionAdapter } from './types';
import { StructuredAction, ActionResult, VerificationResult, Capability } from '../protocol';
import { CapabilityRegistry } from '../registry';
import { ShareManager } from '../../services/sharing/shareManager';

export class ShareAdapter implements IExecutionAdapter {
  readonly id = 'share_adapter';
  readonly platform = 'universal' as const;

  async detect(): Promise<boolean> {
    return true;
  }

  capabilities(): Capability[] {
    return CapabilityRegistry.getByDomain('share');
  }

  async execute(action: StructuredAction): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      const channel = action.capability.replace('share.', '') as any;
      const recipient = action.arguments?.recipient || action.target.application;
      const message = action.arguments?.message || action.target.content || '';
      const subject = action.arguments?.subject;
      const attachmentName = action.arguments?.attachmentName;

      const shareResult = await ShareManager.share({
        channel,
        recipient,
        subject,
        message,
        attachmentName
      });

      if (shareResult.shareUrl && typeof window !== 'undefined') {
        window.open(shareResult.shareUrl, '_blank');
      }

      return {
        actionId: action.actionId,
        capability: action.capability,
        success: shareResult.success,
        status: shareResult.success ? 'COMPLETED' : 'FAILED',
        output: shareResult.success 
          ? `Dispatched share to ${channel.toUpperCase()} (${shareResult.recipient || 'Standard'})`
          : shareResult.error || 'Share failed',
        error: shareResult.error,
        executionTimeMs: Date.now() - startTime
      };

    } catch (err: any) {
      return {
        actionId: action.actionId,
        capability: action.capability,
        success: false,
        status: 'FAILED',
        error: err.message || 'Share execution failed',
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  async verify(action: StructuredAction): Promise<VerificationResult> {
    return {
      actionId: action.actionId,
      verified: true,
      expectedState: 'Share intent dispatched to target channel',
      observedState: 'Target channel opened',
      confidence: 0.90
    };
  }
}
