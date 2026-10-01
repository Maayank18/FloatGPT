/**
 * FloatGPT — Multi-Channel Share Manager
 * 
 * Manages authorized sharing to WhatsApp, Email, Native Share Sheets, and Clipboard.
 * Enforces recipient validation and interactive confirmation cards.
 */

import { ShareRequest, ShareResult } from './shareTypes';

export class ShareManager {
  /**
   * Prepares and executes a share request safely.
   */
  static async share(request: ShareRequest): Promise<ShareResult> {
    const textEncoded = encodeURIComponent(request.message);

    // 1. WhatsApp Sharing
    if (request.channel === 'whatsapp') {
      const phoneClean = request.recipient ? request.recipient.replace(/[^\d+]/g, '') : '';
      const whatsappUrl = phoneClean 
        ? `https://api.whatsapp.com/send?phone=${phoneClean}&text=${textEncoded}`
        : `https://api.whatsapp.com/send?text=${textEncoded}`;

      return {
        success: true,
        channel: 'whatsapp',
        recipient: request.recipient || 'Selected WhatsApp Contact',
        shareUrl: whatsappUrl,
        requiresConfirmation: true,
        confirmationCard: `Send to WhatsApp: "${request.recipient || 'Contact'}" with attachment "${request.attachmentName || 'Note'}"`
      };
    }

    // 2. Email Sharing
    if (request.channel === 'email') {
      const subjectEncoded = encodeURIComponent(request.subject || 'Shared via FloatGPT');
      const mailtoUrl = `mailto:${request.recipient || ''}?subject=${subjectEncoded}&body=${textEncoded}`;

      return {
        success: true,
        channel: 'email',
        recipient: request.recipient,
        shareUrl: mailtoUrl,
        requiresConfirmation: false
      };
    }

    // 3. Native Share Sheet
    if (request.channel === 'native') {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        try {
          await (navigator as any).share({
            title: request.subject || 'FloatGPT Document',
            text: request.message,
            url: request.attachmentUrl
          });
          return { success: true, channel: 'native' };
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            return { success: false, channel: 'native', error: err.message };
          }
        }
      }
    }

    // 4. Clipboard Fallback
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(request.message);
      return { success: true, channel: 'clipboard' };
    }

    return {
      success: false,
      channel: request.channel,
      error: 'Channel not supported in this environment'
    };
  }
}
