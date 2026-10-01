/**
 * FloatGPT — Messenger Agent: Recipient Resolver
 * 
 * Deterministic resolution of recipient queries into authenticated, verified contact identifiers.
 * Strictly prevents guessing when multiple ambiguous matches are found.
 */

import { ResolvedRecipient, MessagePlatform, AmbiguousRecipientResult } from '../types/messenger.types';
import { ContactStore } from './ContactStore';

export type ResolutionResult = 
  | { success: true; recipient: ResolvedRecipient }
  | { success: false; isAmbiguous: true; disambiguation: AmbiguousRecipientResult }
  | { success: false; isAmbiguous: false; error: string };

export class RecipientResolver {
  /**
   * Resolves a raw name, handle, or phone string into a confident recipient.
   */
  static async resolve(query: string, platform: MessagePlatform): Promise<ResolutionResult> {
    const raw = query.trim();
    if (!raw) {
      return {
        success: false,
        isAmbiguous: false,
        error: 'No recipient name or contact identifier was specified.'
      };
    }

    // 1. Check if raw query is already a valid phone number (for WhatsApp)
    if (platform === 'whatsapp') {
      const isDigitsOnly = /^\+?[\d\s\-()]{7,15}$/.test(raw);
      if (isDigitsOnly) {
        const normalized = ContactStore.normalizePhone(raw);
        if (normalized.length >= 10) {
          // Check if already in address book to attach name
          const existing = (await ContactStore.getAll()).find(c => c.phoneNormalized === normalized);
          if (existing) {
            return {
              success: true,
              recipient: existing
            };
          }
          return {
            success: true,
            recipient: {
              id: `direct_${normalized}`,
              name: normalized,
              identifier: normalized,
              phoneNormalized: normalized,
              platform: 'whatsapp',
              verified: true
            }
          };
        }
      }
    }

    // 2. Query Address Book
    const matches = await ContactStore.search(raw, platform);

    // Case A: Exactly 1 confident match
    if (matches.length === 1) {
      return {
        success: true,
        recipient: matches[0]
      };
    }

    // Case B: Multiple ambiguous matches
    if (matches.length > 1) {
      const candidateLines = matches.map((c, idx) => {
        const detail = c.phoneNormalized || c.identifier;
        const meta = c.metadata?.company ? ` (${c.metadata.company})` : '';
        return `${idx + 1}. **${c.name}** — \`${detail}\`${meta}`;
      }).join('\n');

      const disambiguationPrompt = `I found **${matches.length} contacts** matching "${raw}" on ${platform.toUpperCase()}:\n\n${candidateLines}\n\n*Which one should I message? Please specify their full name or number.*`;

      return {
        success: false,
        isAmbiguous: true,
        disambiguation: {
          isAmbiguous: true,
          query: raw,
          candidates: matches,
          disambiguationPrompt
        }
      };
    }

    // Case C: 0 matches found
    return {
      success: false,
      isAmbiguous: false,
      error: `I couldn't find any contact named **"${raw}"** in your ${platform.toUpperCase()} contacts. Please specify their phone number/ID or add them in Settings → Connected Accounts.`
    };
  }
}
