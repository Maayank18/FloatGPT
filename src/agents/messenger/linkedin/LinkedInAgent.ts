/**
 * FloatGPT — LinkedIn Agent
 * 
 * Specialized LinkedIn Agent facilitating direct LinkedIn messaging and network interactions.
 */

import { LinkedInAdapter } from './LinkedInAdapter';
import { ResolvedRecipient, MessagePayload, SendResult } from '../types/messenger.types';

export class LinkedInAgent {
  private static adapter = new LinkedInAdapter();

  static getAdapter(): LinkedInAdapter {
    return this.adapter;
  }

  static async isConnected(): Promise<boolean> {
    return await this.adapter.isAuthenticated();
  }

  static async send(recipient: ResolvedRecipient, message: MessagePayload): Promise<SendResult> {
    return await this.adapter.sendMessage(recipient, message);
  }
}
