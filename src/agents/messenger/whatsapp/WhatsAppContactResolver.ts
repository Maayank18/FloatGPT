/**
 * FloatGPT — WhatsApp Contact Resolver
 * 
 * Resolves contacts for WhatsApp via the local ContactStore,
 * enforcing phone number validation and normalization.
 */

import { ResolvedRecipient, RecipientQuery } from '../types/messenger.types';
import { ContactStore } from '../core/ContactStore';

export class WhatsAppContactResolver {
  /**
   * Resolves recipient candidates for WhatsApp.
   */
  static async resolve(query: RecipientQuery): Promise<ResolvedRecipient[]> {
    const raw = (query.phone || query.name || query.rawQuery || '').trim();
    if (!raw) return [];

    // Search existing contacts
    const matches = await ContactStore.search(raw, 'whatsapp');
    if (matches.length > 0) {
      return matches;
    }

    // If query is a direct phone number, construct a candidate
    const isDigits = /^\+?[\d\s\-()]{7,15}$/.test(raw);
    if (isDigits) {
      const normalized = ContactStore.normalizePhone(raw);
      if (normalized.length >= 10) {
        return [{
          id: `wa_direct_${normalized}`,
          name: normalized,
          identifier: normalized,
          phoneNormalized: normalized,
          platform: 'whatsapp',
          verified: true
        }];
      }
    }

    return [];
  }
}
