/**
 * FloatGPT — Messenger Agent: Message Composer
 * 
 * Validates, normalizes, and packages message payloads according to platform limits.
 */

import { MessagePayload, MessagePlatform } from '../types/messenger.types';

const PLATFORM_MAX_LENGTHS: Record<MessagePlatform, number> = {
  whatsapp: 4096,
  linkedin: 2000,
  telegram: 4096,
  discord: 2000,
  slack: 4000,
  email: 50000
};

export class MessageComposer {
  /**
   * Validates and prepares the final message payload.
   */
  static compose(content: string, platform: MessagePlatform, subject?: string): { success: boolean; payload?: MessagePayload; error?: string } {
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return { success: false, error: 'Cannot compose an empty message.' };
    }

    const trimmed = content.trim();
    const maxLength = PLATFORM_MAX_LENGTHS[platform] || 2000;

    if (trimmed.length > maxLength) {
      return {
        success: false,
        error: `Message exceeds the ${platform.toUpperCase()} character limit of ${maxLength} characters (current length: ${trimmed.length}).`
      };
    }

    // Sanitize non-printable control characters (except newlines and tabs)
    const sanitized = trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return {
      success: true,
      payload: {
        content: sanitized,
        subject: subject?.trim(),
        contentType: 'text'
      }
    };
  }
}
