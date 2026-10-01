/**
 * FloatGPT — Share Manager Types
 */

export type ShareChannel = 'whatsapp' | 'email' | 'native' | 'clipboard';

export interface ShareRequest {
  channel: ShareChannel;
  recipient?: string;
  subject?: string;
  message: string;
  attachmentName?: string;
  attachmentUrl?: string;
}

export interface ShareResult {
  success: boolean;
  channel: ShareChannel;
  recipient?: string;
  shareUrl?: string;
  requiresConfirmation?: boolean;
  confirmationCard?: string;
  error?: string;
}
