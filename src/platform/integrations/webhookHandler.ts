/**
 * FloatGPT — Secure Inbound Webhook Handler
 * 
 * Authenticates enterprise webhooks using HMAC-SHA256 signatures,
 * defends against replay attacks with timestamp drift windows,
 * and enforces idempotent deduplication.
 */

import { hmacSha256Hex, timingSafeMatch } from '../cryptoUtils';
import { InboundWebhookRequest, WebhookProcessingResult } from './types';
import { AuditLogger } from '../audit/auditLogger';

export class WebhookHandler {
  private static processedIds: Set<string> = new Set();
  private static readonly MAX_DRIFT_MS = 5 * 60 * 1000; // 5 minute replay window

  /**
   * Generates a valid HMAC-SHA256 signature for test and client verification.
   */
  static generateSignature(payload: Record<string, any>, timestamp: number, secret: string): string {
    const data = `${timestamp}.${JSON.stringify(payload)}`;
    return hmacSha256Hex(secret, data);
  }

  /**
   * Processes and validates an inbound enterprise webhook request.
   */
  static processWebhook(
    request: InboundWebhookRequest,
    secret: string,
    options?: { now?: number; tenantId?: string; workspaceId?: string }
  ): WebhookProcessingResult {
    const now = options?.now ?? Date.now();

    // 1. Idempotency Check: Drop duplicates immediately
    if (this.processedIds.has(request.id)) {
      return {
        status: 'DUPLICATE_IGNORED',
        reason: `Webhook request "${request.id}" has already been processed.`
      };
    }

    // 2. Anti-Replay Drift Check (< 5 minutes)
    if (Math.abs(now - request.timestamp) > this.MAX_DRIFT_MS) {
      return {
        status: 'REJECTED_REPLAY',
        reason: `Replay attack rejected: Timestamp drift (${Math.abs(now - request.timestamp)}ms) exceeds 5-minute window.`
      };
    }

    // 3. Cryptographic Signature Verification (HMAC-SHA256)
    const expectedSignature = this.generateSignature(request.payload, request.timestamp, secret);
    
    // Constant-time comparison to prevent timing attacks
    if (!timingSafeMatch(request.signature.toLowerCase(), expectedSignature.toLowerCase())) {
      return {
        status: 'REJECTED_SIGNATURE',
        reason: 'HMAC signature verification failed. Invalid secret or tampered payload.'
      };
    }

    // 4. Record as successfully processed
    this.processedIds.add(request.id);

    // 5. Emit Audit Log
    AuditLogger.log({
      actorId: `webhook_${request.source}`,
      tenantId: options?.tenantId || 'tenant_default',
      workspaceId: options?.workspaceId,
      action: 'WEBHOOK_RECEIVED',
      resourceId: request.id,
      details: {
        source: request.source,
        timestamp: request.timestamp,
        keys: Object.keys(request.payload)
      }
    });

    return {
      status: 'ACCEPTED',
      eventId: `ev_wh_${request.id}`
    };
  }

  static isProcessed(id: string): boolean {
    return this.processedIds.has(id);
  }

  static clear(): void {
    this.processedIds.clear();
  }
}
