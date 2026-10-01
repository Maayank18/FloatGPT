/**
 * FloatGPT — WhatsApp Agent
 * 
 * Specialized WhatsApp Agent facilitating direct WhatsApp operations
 * such as status checks, connection, and sending.
 */

import { WhatsAppAdapter } from './WhatsAppAdapter';
import { ResolvedRecipient, MessagePayload, SendResult } from '../types/messenger.types';

export class WhatsAppAgent {
  private static adapter = new WhatsAppAdapter();

  static getAdapter(): WhatsAppAdapter {
    return this.adapter;
  }

  static async isConnected(): Promise<boolean> {
    return await this.adapter.isAuthenticated();
  }

  static async send(recipient: ResolvedRecipient, message: MessagePayload): Promise<SendResult> {
    return await this.adapter.sendMessage(recipient, message);
  }
}
