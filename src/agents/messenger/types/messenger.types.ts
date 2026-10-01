/**
 * FloatGPT — Messenger Agent Types & Architecture Definitions
 * 
 * Formal contract for all messaging platform adapters, intent parsers,
 * recipient resolvers, and persistent schedulers.
 */

export type MessagePlatform = 
  | 'whatsapp'
  | 'linkedin'
  | 'email'
  | 'telegram'
  | 'discord'
  | 'slack';

export type MessageAction = 
  | 'send_message'
  | 'schedule_message'
  | 'cancel_message'
  | 'list_scheduled'
  | 'reschedule_message'
  | 'connect_account'
  | 'disconnect_account'
  | 'resolve_recipient';

export type MessageExecutionStatus = 
  | 'CREATED'
  | 'SCHEDULED'
  | 'QUEUED'
  | 'EXECUTING'
  | 'SENT'
  | 'VERIFIED'
  | 'FAILED'
  | 'RETRYING'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'OVERDUE_PENDING'
  | 'UNKNOWN';

export type VerificationStatus =
  | 'REQUEST_ACCEPTED'
  | 'SEND_CONFIRMED'
  | 'DELIVERY_CONFIRMED'
  | 'PREFILLED'
  | 'UNKNOWN'
  | 'FAILED';

export type AuthStatus = 
  | 'CONNECTED'
  | 'NOT_CONNECTED'
  | 'EXPIRED'
  | 'REQUIRES_REAUTH';

export interface AuthCredentials {
  platform: MessagePlatform;
  accountId?: string;
  accountName?: string;
  accessToken?: string;
  refreshToken?: string;
  phoneNumber?: string;
  apiKey?: string;
  metadata?: Record<string, any>;
}

export interface AuthResult {
  success: boolean;
  status: AuthStatus;
  platform: MessagePlatform;
  accountName?: string;
  accountId?: string;
  error?: string;
  connectedAt?: number;
}

export interface RecipientQuery {
  rawQuery: string;
  name?: string;
  phone?: string;
  handle?: string;
  platform?: MessagePlatform;
}

export interface ResolvedRecipient {
  id: string;
  name: string;
  identifier: string; // Phone number in E.164, email, or LinkedIn URN
  platform: MessagePlatform;
  phoneNormalized?: string;
  avatarUrl?: string;
  verified: boolean;
  metadata?: Record<string, any>;
}

export interface AmbiguousRecipientResult {
  isAmbiguous: true;
  query: string;
  candidates: ResolvedRecipient[];
  disambiguationPrompt: string;
}

export interface MessagePayload {
  content: string;
  subject?: string;
  attachments?: string[];
  contentType?: 'text' | 'template' | 'rich';
}

export interface SendOptions {
  operationId?: string;
  idempotencyKey?: string;
  priority?: 'normal' | 'high';
  timeoutMs?: number;
  skipVerification?: boolean;
  clientType?: 'desktop' | 'web';
}

export interface SendResult {
  success: boolean;
  operationId: string;
  platformMessageId?: string;
  status: MessageExecutionStatus;
  verificationStatus?: VerificationStatus;
  error?: string;
  timestamp: number;
  platform: MessagePlatform;
  recipient: ResolvedRecipient;
  details?: string;
}

export interface VerificationResult {
  operationId: string;
  platformMessageId?: string;
  verified: boolean;
  status: VerificationStatus;
  message?: string;
  timestamp: number;
  deliveryTimestamp?: number;
}

export interface MessengerCapabilities {
  platform: MessagePlatform;
  supportsScheduling: boolean;
  supportsVerification: boolean;
  supportsRichText: boolean;
  supportsAttachments: boolean;
  supportsTemplates: boolean;
  rateLimitPerMinute: number;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffFactor: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

export interface ScheduledMessageJob {
  id: string;
  operationId: string;
  idempotencyKey: string;
  platform: MessagePlatform;
  recipient: ResolvedRecipient;
  message: MessagePayload;
  scheduledAt: string; // ISO 8601 string in user's local timezone
  scheduledEpochMs: number;
  timezone: string;
  status: MessageExecutionStatus;
  attemptCount: number;
  maxRetries: number;
  lastAttemptAt?: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
  retryPolicy?: RetryPolicy;
  clientType?: 'desktop' | 'web';
}

export interface MessengerAuditRecord {
  operationId: string;
  idempotencyKey: string;
  platform: MessagePlatform;
  recipientId: string;
  recipientName: string;
  recipientIdentifier: string;
  messageSnippet: string;
  status: MessageExecutionStatus;
  verificationStatus?: VerificationStatus;
  scheduledAt?: string;
  executedAt?: number;
  attemptCount: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: number;
}

export interface ParsedMessageIntent {
  rawPrompt: string;
  platform: MessagePlatform;
  action: MessageAction;
  recipientQuery?: string;
  messageContent?: string;
  scheduledAt?: string | null;
  scheduledEpochMs?: number | null;
  timezone: string;
  confidence: number;
  targetJobId?: string;
  clientPreference?: 'desktop' | 'web';
}

/**
 * Common adapter interface for all messaging platforms.
 */
export interface IMessengerAdapter {
  readonly platform: MessagePlatform;

  authenticate(credentials?: AuthCredentials): Promise<AuthResult>;

  isAuthenticated(): Promise<boolean>;

  getAccountInfo(): Promise<AuthResult>;

  disconnect(): Promise<boolean>;

  resolveRecipient(query: RecipientQuery): Promise<ResolvedRecipient[]>;

  sendMessage(
    recipient: ResolvedRecipient,
    message: MessagePayload,
    options?: SendOptions
  ): Promise<SendResult>;

  verifySend(
    operationId: string,
    platformMessageId?: string
  ): Promise<VerificationResult>;

  getCapabilities(): MessengerCapabilities;
}
