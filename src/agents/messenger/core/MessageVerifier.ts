/**
 * FloatGPT — Messenger Agent: Message Verifier
 * 
 * Central verification engine verifying delivery receipts and submission states
 * across all messaging platforms.
 */

import { VerificationResult, MessagePlatform } from '../types/messenger.types';
import { MessengerRegistry } from './MessengerRegistry';

export class MessageVerifier {
  /**
   * Verifies the status of a sent message through its platform adapter.
   */
  static async verify(
    platform: MessagePlatform,
    operationId: string,
    platformMessageId?: string
  ): Promise<VerificationResult> {
    const adapter = MessengerRegistry.get(platform);
    if (!adapter) {
      return {
        operationId,
        platformMessageId,
        verified: false,
        status: 'UNKNOWN',
        message: `No adapter available to verify platform "${platform}".`,
        timestamp: Date.now()
      };
    }

    try {
      return await adapter.verifySend(operationId, platformMessageId);
    } catch (err: any) {
      return {
        operationId,
        platformMessageId,
        verified: false,
        status: 'UNKNOWN',
        message: err.message || 'Verification threw an unhandled error.',
        timestamp: Date.now()
      };
    }
  }
}
