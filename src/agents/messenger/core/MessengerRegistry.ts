/**
 * FloatGPT — Messenger Agent: Platform Adapter Registry
 * 
 * Central registry of all active messaging adapters.
 * Ensures clean extensibility for future platforms (Telegram, Discord, Slack, Email).
 */

import { IMessengerAdapter, MessagePlatform } from '../types/messenger.types';
import { WhatsAppAdapter } from '../whatsapp/WhatsAppAdapter';

export class MessengerRegistry {
  private static adapters: Map<MessagePlatform, IMessengerAdapter> = new Map();

  static {
    this.register(new WhatsAppAdapter());
  }

  static register(adapter: IMessengerAdapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  static get(platform: MessagePlatform): IMessengerAdapter | null {
    return this.adapters.get(platform) || null;
  }

  static has(platform: MessagePlatform): boolean {
    return this.adapters.has(platform);
  }

  static listSupported(): MessagePlatform[] {
    return Array.from(this.adapters.keys());
  }
}
