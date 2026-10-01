/**
 * FloatGPT — LinkedIn Platform Adapter
 * 
 * Concrete implementation of IMessengerAdapter for LinkedIn.
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
import { LinkedInAuth } from './LinkedInAuth';
import { LinkedInContactResolver } from './LinkedInContactResolver';
import { LinkedInMessageSender } from './LinkedInMessageSender';
import { LinkedInVerifier } from './LinkedInVerifier';

export class LinkedInAdapter implements IMessengerAdapter {
  readonly platform: MessagePlatform = 'linkedin';

  async authenticate(credentials?: AuthCredentials): Promise<AuthResult> {
    if (credentials?.accountId || credentials?.accountName) {
      return await LinkedInAuth.connectAccount({
        profileHandle: credentials.accountId || credentials.accountName || 'user',
        accountName: credentials.accountName,
        accessToken: credentials.accessToken
      });
    }
    return await LinkedInAuth.getAccountInfo();
  }

  async isAuthenticated(): Promise<boolean> {
    return await LinkedInAuth.isAuthenticated();
  }

  async getAccountInfo(): Promise<AuthResult> {
    return await LinkedInAuth.getAccountInfo();
  }

  async disconnect(): Promise<boolean> {
    return await LinkedInAuth.disconnect();
  }

  async resolveRecipient(query: RecipientQuery): Promise<ResolvedRecipient[]> {
    return await LinkedInContactResolver.resolve(query);
  }

  async sendMessage(
    recipient: ResolvedRecipient,
    message: MessagePayload,
    options?: SendOptions
  ): Promise<SendResult> {
    return await LinkedInMessageSender.send(recipient, message, options);
  }

  async verifySend(
    operationId: string,
    platformMessageId?: string
  ): Promise<VerificationResult> {
    return await LinkedInVerifier.verify(operationId, platformMessageId);
  }

  getCapabilities(): MessengerCapabilities {
    return {
      platform: 'linkedin',
      supportsScheduling: true,
      supportsVerification: true,
      supportsRichText: false,
      supportsAttachments: false,
      supportsTemplates: false,
      rateLimitPerMinute: 30
    };
  }
}
