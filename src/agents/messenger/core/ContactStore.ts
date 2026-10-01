/**
 * FloatGPT — Messenger Agent: Contact Store
 * 
 * Persistent local address book backed by IndexedDB (idb-keyval).
 * Normalizes phone numbers (E.164), matches aliases, and supports disambiguation.
 */

import { get, set } from 'idb-keyval';
import { ResolvedRecipient, MessagePlatform } from '../types/messenger.types';

const CONTACTS_STORE_KEY = 'floatgpt_messenger_contacts';

// Initial pre-loaded seed contacts for testing recipient resolution & disambiguation
const INITIAL_SEEDS: ResolvedRecipient[] = [
  {
    id: 'contact_adam_sharma',
    name: 'Adam Sharma',
    identifier: '+919876543210',
    phoneNormalized: '+919876543210',
    platform: 'whatsapp',
    verified: true,
    metadata: { relationship: 'colleague', company: 'FloatAI' }
  },
  {
    id: 'contact_adam_verma',
    name: 'Adam Verma',
    identifier: '+919812345678',
    phoneNormalized: '+919812345678',
    platform: 'whatsapp',
    verified: true,
    metadata: { relationship: 'client', company: 'Verma Tech' }
  },
  {
    id: 'contact_rahul_verma',
    name: 'Rahul Verma',
    identifier: '+919988776655',
    phoneNormalized: '+919988776655',
    platform: 'whatsapp',
    verified: true,
    metadata: { relationship: 'friend' }
  },
  {
    id: 'contact_sarah_jenkins_wa',
    name: 'Sarah Jenkins',
    identifier: '+14155552671',
    phoneNormalized: '+14155552671',
    platform: 'whatsapp',
    verified: true
  },
  {
    id: 'contact_sarah_jenkins_li',
    name: 'Sarah Jenkins',
    identifier: 'sarah-jenkins-tech',
    platform: 'linkedin',
    verified: true,
    metadata: { headline: 'VP of Engineering', connectionDegree: '1st' }
  },
  {
    id: 'contact_john_doe_li',
    name: 'John Doe',
    identifier: 'john-doe-lead',
    platform: 'linkedin',
    verified: true,
    metadata: { headline: 'Product Architect', connectionDegree: '1st' }
  }
];

export class ContactStore {
  private static memoryCache: ResolvedRecipient[] | null = null;

  /**
   * Normalizes phone number into E.164-compatible standard.
   */
  static normalizePhone(input: string): string {
    if (!input) return '';
    const trimmed = input.trim();
    // Keep leading plus if present
    const hasPlus = trimmed.startsWith('+');
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (!digitsOnly) return '';
    return hasPlus ? `+${digitsOnly}` : (digitsOnly.length === 10 ? `+91${digitsOnly}` : `+${digitsOnly}`);
  }

  /**
   * Loads all contacts from IndexedDB. Default is an empty address book
   * so the user can add and manage their own legitimate contacts.
   */
  static async getAll(): Promise<ResolvedRecipient[]> {
    if (this.memoryCache) return this.memoryCache;

    try {
      const stored = await Promise.race([
        get<ResolvedRecipient[]>(CONTACTS_STORE_KEY),
        new Promise<null>((r) => setTimeout(() => r(null), 300))
      ]);
      if (stored && Array.isArray(stored)) {
        this.memoryCache = stored;
        return stored;
      }
    } catch (e) {
      console.warn('[ContactStore] Failed to read from IndexedDB:', e);
    }

    // Default clean state: empty address book
    this.memoryCache = [];
    return this.memoryCache;
  }

  /**
   * Helper for automated test suites to seed test contacts.
   */
  static async seedForTesting(): Promise<void> {
    this.memoryCache = [...INITIAL_SEEDS];
    if (typeof indexedDB !== 'undefined') {
      try {
        await set(CONTACTS_STORE_KEY, this.memoryCache);
      } catch {}
    }
  }

  /**
   * Checks if the currently loaded list contains demo seed contacts.
   */
  static hasDemoContacts(contacts: ResolvedRecipient[]): boolean {
    if (!contacts || contacts.length === 0) return false;
    const demoIds = new Set(INITIAL_SEEDS.map(s => s.id));
    return contacts.some(c => demoIds.has(c.id));
  }

  /**
   * Clears demo seed contacts so user has a clean address book.
   */
  static async clearDemoContacts(): Promise<boolean> {
    const contacts = await this.getAll();
    const demoIds = new Set(INITIAL_SEEDS.map(s => s.id));
    const userOnly = contacts.filter(c => !demoIds.has(c.id));
    this.memoryCache = userOnly;
    if (typeof indexedDB !== 'undefined') {
      try {
        await set(CONTACTS_STORE_KEY, userOnly);
      } catch {}
    }
    return true;
  }

  /**
   * Clears all contacts from the address book.
   */
  static async clearAll(): Promise<boolean> {
    this.memoryCache = [];
    if (typeof indexedDB !== 'undefined') {
      try {
        await set(CONTACTS_STORE_KEY, []);
      } catch {}
    }
    return true;
  }

  /**
   * Loads sample demo contacts if user explicitly requests them for testing.
   */
  static async loadSampleContacts(): Promise<ResolvedRecipient[]> {
    const contacts = await this.getAll();
    const existingIds = new Set(contacts.map(c => c.id));
    const newSeeds = INITIAL_SEEDS.filter(s => !existingIds.has(s.id));
    const merged = [...contacts, ...newSeeds];
    this.memoryCache = merged;
    if (typeof indexedDB !== 'undefined') {
      try {
        await set(CONTACTS_STORE_KEY, merged);
      } catch {}
    }
    return merged;
  }

  /**
   * Searches contacts by name, alias, phone, identifier, or metadata tags (e.g. Mummy, Colleague, Friend).
   */
  static async search(query: string, platform?: MessagePlatform): Promise<ResolvedRecipient[]> {
    const contacts = await this.getAll();
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    const phoneQuery = this.normalizePhone(cleanQuery);
    const digitsOnlyQuery = cleanQuery.replace(/\D/g, '');

    return contacts.filter(c => {
      if (platform && c.platform !== platform) {
        return false;
      }

      // 1. Name match
      const nameMatch = c.name.toLowerCase().includes(cleanQuery);
      
      // 2. Identifier match (phone or linkedin profile)
      const idMatch = c.identifier.toLowerCase().includes(cleanQuery);

      // 3. Phone / Digits match (handles raw 10 digits e.g. 9953314976 matching +919953314976)
      const cDigits = (c.phoneNormalized || c.identifier || '').replace(/\D/g, '');
      const digitsMatch = Boolean(digitsOnlyQuery && digitsOnlyQuery.length >= 7 && (cDigits.includes(digitsOnlyQuery) || digitsOnlyQuery.includes(cDigits)));
      const phoneMatch = Boolean(phoneQuery && c.phoneNormalized && (c.phoneNormalized.includes(phoneQuery) || phoneQuery.includes(c.phoneNormalized)));

      // 4. Metadata tags: company, relationship, notes, headline (e.g. "Mummy", "Mom", "Dad", "Boss")
      const companyMatch = Boolean(c.metadata?.company && c.metadata.company.toLowerCase().includes(cleanQuery));
      const relationMatch = Boolean(c.metadata?.relationship && c.metadata.relationship.toLowerCase().includes(cleanQuery));
      const headlineMatch = Boolean(c.metadata?.headline && c.metadata.headline.toLowerCase().includes(cleanQuery));

      return nameMatch || idMatch || phoneMatch || digitsMatch || companyMatch || relationMatch || headlineMatch;
    });
  }

  /**
   * Adds or updates a contact.
   */
  static async saveContact(contact: Partial<ResolvedRecipient> & { name: string; identifier: string; platform: MessagePlatform }): Promise<ResolvedRecipient> {
    const contacts = await this.getAll();
    const normalizedPhone = contact.platform === 'whatsapp' ? this.normalizePhone(contact.identifier) : undefined;
    
    const existingIndex = contacts.findIndex(c => 
      c.id === contact.id || 
      (c.platform === contact.platform && c.identifier.toLowerCase() === contact.identifier.toLowerCase())
    );

    const resolved: ResolvedRecipient = {
      id: contact.id || `contact_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: contact.name.trim(),
      identifier: normalizedPhone || contact.identifier.trim(),
      platform: contact.platform,
      phoneNormalized: normalizedPhone,
      avatarUrl: contact.avatarUrl,
      verified: contact.verified ?? true,
      metadata: contact.metadata || {}
    };

    if (existingIndex >= 0) {
      contacts[existingIndex] = { ...contacts[existingIndex], ...resolved };
    } else {
      contacts.push(resolved);
    }

    this.memoryCache = contacts;
    if (typeof indexedDB !== 'undefined') {
      try {
        await set(CONTACTS_STORE_KEY, contacts);
      } catch {}
    }
    return resolved;
  }

  /**
   * Deletes a contact by ID.
   */
  static async deleteContact(id: string): Promise<boolean> {
    const contacts = await this.getAll();
    const filtered = contacts.filter(c => c.id !== id);
    if (filtered.length !== contacts.length) {
      this.memoryCache = filtered;
      if (typeof indexedDB !== 'undefined') {
        try {
          await set(CONTACTS_STORE_KEY, filtered);
        } catch {}
      }
      return true;
    }
    return false;
  }
}
