/**
 * FloatGPT — Enterprise Connectors & Webhook Integration Types
 * 
 * Defines schemas for external connectors, webhook verification,
 * and security defenses (HMAC signatures, anti-replay, idempotency).
 */

export type ConnectorStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'SYNCING';

export interface ConnectorConfig {
  tenantId: string;
  workspaceId: string;
  apiKey?: string;
  webhookSecret?: string;
  rateLimitPerMinute?: number;
}

export interface IConnector {
  id: string;
  name: string;
  status: ConnectorStatus;
  initialize(config: ConnectorConfig): Promise<boolean>;
  sync(): Promise<Record<string, any>>;
  disconnect(): Promise<boolean>;
}

export interface InboundWebhookRequest {
  id: string; // Idempotency key
  signature: string; // HMAC-SHA256
  timestamp: number; // Unix timestamp
  source: string; // e.g., 'github', 'zendesk', 'stripe'
  payload: Record<string, any>;
}

export interface WebhookProcessingResult {
  status: 'ACCEPTED' | 'REJECTED_SIGNATURE' | 'REJECTED_REPLAY' | 'DUPLICATE_IGNORED';
  reason?: string;
  eventId?: string;
}
