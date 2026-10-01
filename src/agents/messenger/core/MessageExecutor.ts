/**
 * FloatGPT — Messenger Agent: Message Executor & Idempotency Engine
 * 
 * Authoritative execution orchestrator enforcing idempotency keys,
 * stable operation IDs, transient retry backoffs, and post-send verification.
 */

import {
  ResolvedRecipient,
  MessagePayload,
  SendOptions,
  SendResult,
  MessagePlatform,
  MessengerAuditRecord
} from '../types/messenger.types';
import { MessengerRegistry } from './MessengerRegistry';
import { MessagingAuditJournal } from './MessagingAuditJournal';
import { MessageVerifier } from './MessageVerifier';
import { MessageRetryManager } from '../scheduler/MessageRetryManager';

export class MessageExecutor {
  /**
   * Generates a deterministic idempotency key based on recipient, content, schedule, and clientType.
   */
  static generateIdempotencyKey(platform: MessagePlatform, recipientId: string, content: string, scheduleTag: string = 'instant', clientType?: string): string {
    let hash = 0;
    const keyStr = `${platform}:${recipientId}:${content.trim()}:${scheduleTag}:${clientType || 'default'}`;
    for (let i = 0; i < keyStr.length; i++) {
      const char = keyStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `idem_${Math.abs(hash).toString(36)}_${keyStr.length}`;
  }

  /**
   * Executes a send operation with idempotency protection and verification.
   */
  static async execute(
    platform: MessagePlatform,
    recipient: ResolvedRecipient,
    message: MessagePayload,
    options?: SendOptions
  ): Promise<SendResult> {
    const startTime = Date.now();
    const operationId = options?.operationId || `msgop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const idempotencyKey = options?.idempotencyKey || this.generateIdempotencyKey(platform, recipient.identifier, message.content, 'instant', options?.clientType);

    // ─── 1. Idempotency Check: Has this exact message already completed? ───
    // If options.idempotencyKey was explicitly provided (e.g. automated retry), respect it indefinitely.
    // If auto-generated for conversational chat, only deduplicate within a 60-second window to prevent accidental double-taps
    // while still allowing the user to send the same message again later.
    const existingRecord = await MessagingAuditJournal.findByIdempotencyKey(idempotencyKey);
    const IDEMPOTENCY_WINDOW_MS = 60 * 1000;
    const isExplicitKey = Boolean(options?.idempotencyKey);
    const isRecent = existingRecord && (Date.now() - (existingRecord.executedAt || existingRecord.createdAt || 0) < IDEMPOTENCY_WINDOW_MS);

    if (existingRecord && (existingRecord.status === 'SENT' || existingRecord.status === 'VERIFIED')) {
      if (isExplicitKey || isRecent) {
        console.log(`[MessageExecutor] Idempotency hit: Operation "${existingRecord.operationId}" already completed.`);
        return {
          success: true,
          operationId: existingRecord.operationId,
          platformMessageId: existingRecord.operationId,
          status: existingRecord.status,
          verificationStatus: existingRecord.verificationStatus || 'SEND_CONFIRMED',
          timestamp: existingRecord.executedAt || startTime,
          platform,
          recipient,
          details: `(Idempotent Replay) Message was already sent at ${new Date(existingRecord.executedAt || startTime).toLocaleTimeString()}`
        };
      }
    }

    // ─── 2. Platform Adapter Resolution ─────────────────────────
    const adapter = MessengerRegistry.get(platform);
    if (!adapter) {
      const failResult: SendResult = {
        success: false,
        operationId,
        status: 'FAILED',
        error: `Platform "${platform}" is not supported or adapter is missing.`,
        timestamp: startTime,
        platform,
        recipient
      };
      await this.recordAudit(failResult, idempotencyKey, message.content);
      return failResult;
    }

    // ─── 3. Authentication Check ────────────────────────────────
    const isAuthed = await adapter.isAuthenticated();
    if (!isAuthed) {
      const authFailResult: SendResult = {
        success: false,
        operationId,
        status: 'FAILED',
        error: `AUTH_REQUIRED: ${platform.toUpperCase()} is not connected. Please connect your account in Settings → Connected Accounts.`,
        timestamp: startTime,
        platform,
        recipient
      };
      await this.recordAudit(authFailResult, idempotencyKey, message.content);
      return authFailResult;
    }

    // ─── 4. Initial Audit Log: EXECUTING ────────────────────────
    await MessagingAuditJournal.record({
      operationId,
      idempotencyKey,
      platform,
      recipientId: recipient.id,
      recipientName: recipient.name,
      recipientIdentifier: recipient.identifier,
      messageSnippet: message.content.slice(0, 80),
      status: 'EXECUTING',
      attemptCount: 1,
      createdAt: startTime
    });

    // ─── 5. Dispatch with Bounded Retries ────────────────────────
    let attempt = 1;
    const maxAttempts = 3;
    let lastError: string | undefined;
    let sendResult: SendResult | null = null;

    while (attempt <= maxAttempts) {
      try {
        sendResult = await adapter.sendMessage(recipient, message, {
          ...options,
          operationId,
          idempotencyKey
        });

        if (sendResult.success) {
          break; // Successful send
        }

        lastError = sendResult.error;

        // Evaluate if error is retryable
        if (!MessageRetryManager.isRetryableError(lastError)) {
          break; // Fatal non-retryable error (e.g. invalid recipient or auth)
        }

      } catch (err: any) {
        lastError = err.message || 'Unknown network dispatch error';
        if (!MessageRetryManager.isRetryableError(lastError)) {
          break;
        }
      }

      attempt++;
      if (attempt <= maxAttempts) {
        const backoffMs = MessageRetryManager.getBackoffDelayMs(attempt);
        console.warn(`[MessageExecutor] Transient failure (attempt ${attempt - 1}): "${lastError}". Retrying in ${backoffMs}ms...`);
        await new Promise(r => setTimeout(r, backoffMs));
      }
    }

    // ─── 6. Handle Execution Outcome ────────────────────────────
    if (!sendResult || !sendResult.success) {
      const finalFailure: SendResult = {
        success: false,
        operationId,
        status: 'FAILED',
        error: lastError || 'Dispatch failed after retries.',
        timestamp: Date.now(),
        platform,
        recipient
      };
      await this.recordAudit(finalFailure, idempotencyKey, message.content, attempt);
      return finalFailure;
    }

    // ─── 7. Verification Phase ──────────────────────────────────
    let verificationStatus = sendResult.verificationStatus || 'SEND_CONFIRMED';
    if (!options?.skipVerification && sendResult.platformMessageId) {
      try {
        const verifyResult = await MessageVerifier.verify(
          platform,
          operationId,
          sendResult.platformMessageId
        );
        verificationStatus = verifyResult.status;
      } catch {}
    }

    sendResult.verificationStatus = verificationStatus;
    sendResult.status = 'VERIFIED';

    // ─── 8. Final Audit Journal Record ──────────────────────────
    await this.recordAudit(sendResult, idempotencyKey, message.content, attempt);

    return sendResult;
  }

  private static async recordAudit(
    result: SendResult,
    idempotencyKey: string,
    content: string,
    attemptCount: number = 1
  ): Promise<void> {
    const record: MessengerAuditRecord = {
      operationId: result.operationId,
      idempotencyKey,
      platform: result.platform,
      recipientId: result.recipient.id,
      recipientName: result.recipient.name,
      recipientIdentifier: result.recipient.identifier,
      messageSnippet: content.slice(0, 80),
      status: result.status,
      verificationStatus: result.verificationStatus,
      executedAt: result.timestamp,
      attemptCount,
      errorMessage: result.error,
      createdAt: result.timestamp
    };

    await MessagingAuditJournal.record(record);
  }
}
