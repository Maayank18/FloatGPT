/**
 * FloatGPT — LinkedIn Contact Resolver
 * 
 * Resolves LinkedIn connections and public profile handles.
 */

import { ResolvedRecipient, RecipientQuery } from '../types/messenger.types';
import { ContactStore } from '../core/ContactStore';

export class LinkedInContactResolver {
  static async resolve(query: RecipientQuery): Promise<ResolvedRecipient[]> {
    const raw = (query.name || query.handle || query.rawQuery || '').trim();
    if (!raw) return [];

    // Search existing contacts on linkedin
    const matches = await ContactStore.search(raw, 'linkedin');
    if (matches.length > 0) {
      return matches;
    }

    // Direct handle candidate
    if (/^[a-z0-9\-]+$/i.test(raw)) {
      return [{
        id: `li_direct_${raw.toLowerCase()}`,
        name: raw,
        identifier: raw.toLowerCase(),
        platform: 'linkedin',
        verified: true
      }];
    }

    return [];
  }
}
