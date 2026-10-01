/**
 * FloatGPT — WhatsApp Platform Adapter
 * 
 * Concrete implementation of IMessengerAdapter for WhatsApp.
 */

import {
  IMessengerAdapter,
  MessagePlatform,
  AuthCredentials,
  AuthResult,
  RecipientQuery,
  ResolvedRecipient,
  MessagePayload,
  SendOptions,
  SendResult,
  VerificationResult,
  MessengerCapabilities
} from '../types/messenger.types';
import { WhatsAppAuth } from './WhatsAppAuth';
import { WhatsAppContactResolver } from './WhatsAppContactResolver';
import { WhatsAppMessageSender } from './WhatsAppMessageSender';
import { WhatsAppVerifier } from './WhatsAppVerifier';

export class WhatsAppAdapter implements IMessengerAdapter {
  readonly platform: MessagePlatform = 'whatsapp';

  async authenticate(credentials?: AuthCredentials): Promise<AuthResult> {
    if (credentials?.phoneNumber) {
      return await WhatsAppAuth.connectAccount({
        phoneNumber: credentials.phoneNumber,
        accountName: credentials.accountName,
        clientType: credentials.metadata?.clientType,
        accessToken: credentials.accessToken,
        phoneNumberId: credentials.accountId
      });
    }
    return await WhatsAppAuth.getAccountInfo();
  }

  async isAuthenticated(): Promise<boolean> {
    return await WhatsAppAuth.isAuthenticated();
  }

  async getAccountInfo(): Promise<AuthResult> {
    return await WhatsAppAuth.getAccountInfo();
  }

  async disconnect(): Promise<boolean> {
    return await WhatsAppAuth.disconnect();
  }

  async resolveRecipient(query: RecipientQuery): Promise<ResolvedRecipient[]> {
    return await WhatsAppContactResolver.resolve(query);
  }

  async sendMessage(
    recipient: ResolvedRecipient,
    message: MessagePayload,
    options?: SendOptions
  ): Promise<SendResult> {
    return await WhatsAppMessageSender.send(recipient, message, options);
  }

  async verifySend(
    operationId: string,
    platformMessageId?: string
  ): Promise<VerificationResult> {
    return await WhatsAppVerifier.verify(operationId, platformMessageId);
  }

  getCapabilities(): MessengerCapabilities {
    return {
      platform: 'whatsapp',
      supportsScheduling: true,
      supportsVerification: true,
      supportsRichText: false,
      supportsAttachments: true,
      supportsTemplates: true,
      rateLimitPerMinute: 60
    };
  }
}
