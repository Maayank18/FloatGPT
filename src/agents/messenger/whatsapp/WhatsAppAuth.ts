/**
 * FloatGPT — WhatsApp Messenger Agent: Authentication & Session Store
 * 
 * Persistent WhatsApp credentials and connection state backed by IndexedDB.
 * Enforces strict authentication boundaries before any message can be dispatched.
 */

import { get, set, del } from 'idb-keyval';
import { AuthResult, AuthStatus } from '../types/messenger.types';

const WHATSAPP_AUTH_KEY = 'floatgpt_whatsapp_auth_session';

export interface WhatsAppSessionData {
  status: AuthStatus;
  phoneNumber: string;
  accountName: string;
  clientType?: 'desktop' | 'web' | 'ask';
  clientMigrationV2?: boolean;
  accessToken?: string;
  phoneNumberId?: string;
  wabaId?: string;
  connectedAt: number;
  lastVerifiedAt: number;
}

export class WhatsAppAuth {
  private static cachedSession: WhatsAppSessionData | null = null;

  /**
   * Loads session from IndexedDB. Defaults to NOT_CONNECTED so the user
   * can connect their own real WhatsApp phone number.
   */
  private static async loadSession(): Promise<WhatsAppSessionData | null> {
    if (this.cachedSession) return this.cachedSession;

    try {
      const stored = await Promise.race([
        get<WhatsAppSessionData>(WHATSAPP_AUTH_KEY),
        new Promise<null>((r) => setTimeout(() => r(null), 300))
      ]);
      if (stored) {
        // Migration safeguard: if the stored session is the old hardcoded demo profile, reset it to NOT_CONNECTED
        if (stored.phoneNumber === '+919876543210' && stored.accountName === 'FloatGPT Primary WhatsApp' && !stored.accessToken) {
          const unauthed: WhatsAppSessionData = {
            status: 'NOT_CONNECTED',
            phoneNumber: '',
            accountName: '',
            clientType: 'ask',
            clientMigrationV2: true,
            connectedAt: 0,
            lastVerifiedAt: 0
          };
          this.cachedSession = unauthed;
          try { await set(WHATSAPP_AUTH_KEY, unauthed); } catch {}
          return unauthed;
        }

        // Migration V2: Ensure any unmigrated session defaults to 'ask'
        // so the user gets prompted to choose Desktop vs Web instead of launching unauthenticated Desktop app
        if (!stored.clientMigrationV2) {
          stored.clientType = 'ask';
          stored.clientMigrationV2 = true;
          try { await set(WHATSAPP_AUTH_KEY, stored); } catch {}
        }

        this.cachedSession = stored;
        return stored;
      }
    } catch (e) {
      console.warn('[WhatsAppAuth] Failed to read auth session from IndexedDB:', e);
    }

    // Default clean state: NOT_CONNECTED with 'ask' preference
    const defaultSession: WhatsAppSessionData = {
      status: 'NOT_CONNECTED',
      phoneNumber: '',
      accountName: '',
      clientType: 'ask',
      clientMigrationV2: true,
      connectedAt: 0,
      lastVerifiedAt: 0
    };

    this.cachedSession = defaultSession;
    return defaultSession;
  }

  /**
   * Helper for automated test suites to seed an active test session.
   */
  static async seedForTesting(): Promise<void> {
    const testSession: WhatsAppSessionData = {
      status: 'CONNECTED',
      phoneNumber: '+919876543210',
      accountName: 'Test WhatsApp Session',
      clientType: 'web',
      clientMigrationV2: true,
      connectedAt: Date.now(),
      lastVerifiedAt: Date.now()
    };
    this.cachedSession = testSession;
    if (typeof indexedDB !== 'undefined') {
      try { await set(WHATSAPP_AUTH_KEY, testSession); } catch {}
    }
  }

  /**
   * Returns true if a valid, active WhatsApp account is authenticated.
   */
  static async isAuthenticated(): Promise<boolean> {
    const session = await this.loadSession();
    return session !== null && session.status === 'CONNECTED' && Boolean(session.phoneNumber?.trim());
  }

  /**
   * Retrieves the raw session data if connected.
   */
  static async getSessionData(): Promise<WhatsAppSessionData | null> {
    return this.loadSession();
  }

  /**
   * Retrieves the user's preferred WhatsApp client ('desktop' | 'web' | 'ask').
   */
  static async getClientType(): Promise<'desktop' | 'web' | 'ask'> {
    const session = await this.loadSession();
    return session?.clientType || 'ask';
  }

  /**
   * Sets the user's preferred WhatsApp client ('desktop' | 'web' | 'ask') and persists to IndexedDB.
   */
  static async setClientType(clientType: 'desktop' | 'web' | 'ask'): Promise<boolean> {
    const session = await this.loadSession();
    const updated: WhatsAppSessionData = {
      ...(session || {
        status: 'NOT_CONNECTED',
        phoneNumber: '',
        accountName: '',
        connectedAt: 0,
        lastVerifiedAt: 0
      }),
      clientType,
      clientMigrationV2: true
    };

    this.cachedSession = updated;
    if (typeof indexedDB !== 'undefined') {
      try {
        await set(WHATSAPP_AUTH_KEY, updated);
      } catch (err) {
        console.warn('[WhatsAppAuth] Failed to persist clientType update:', err);
      }
    }
    return true;
  }

  /**
   * Retrieves account information.
   */
  static async getAccountInfo(): Promise<AuthResult> {
    const session = await this.loadSession();
    if (!session || session.status !== 'CONNECTED') {
      return {
        success: false,
        status: 'NOT_CONNECTED',
        platform: 'whatsapp',
        error: 'WhatsApp account is not connected.'
      };
    }

    return {
      success: true,
      status: session.status,
      platform: 'whatsapp',
      accountName: session.accountName,
      accountId: session.phoneNumber,
      connectedAt: session.connectedAt
    };
  }

  /**
   * Connects a new WhatsApp account or updates Cloud API credentials.
   */
  static async connectAccount(params: {
    phoneNumber: string;
    accountName?: string;
    clientType?: 'desktop' | 'web' | 'ask';
    accessToken?: string;
    phoneNumberId?: string;
    wabaId?: string;
  }): Promise<AuthResult> {
    const existing = await this.loadSession();
    const session: WhatsAppSessionData = {
      status: 'CONNECTED',
      phoneNumber: params.phoneNumber.trim(),
      accountName: params.accountName?.trim() || `WhatsApp (${params.phoneNumber})`,
      clientType: params.clientType || existing?.clientType || 'ask',
      clientMigrationV2: true,
      accessToken: params.accessToken?.trim(),
      phoneNumberId: params.phoneNumberId?.trim(),
      wabaId: params.wabaId?.trim(),
      connectedAt: Date.now(),
      lastVerifiedAt: Date.now()
    };

    this.cachedSession = session;
    if (typeof indexedDB !== 'undefined') {
      try {
        await set(WHATSAPP_AUTH_KEY, session);
      } catch {}
    }

    return {
      success: true,
      status: 'CONNECTED',
      platform: 'whatsapp',
      accountName: session.accountName,
      accountId: session.phoneNumber,
      connectedAt: session.connectedAt
    };
  }

  /**
   * Disconnects the WhatsApp session.
   */
  static async disconnect(): Promise<boolean> {
    const existing = await this.loadSession();
    const session: WhatsAppSessionData = {
      status: 'NOT_CONNECTED',
      phoneNumber: '',
      accountName: '',
      clientType: existing?.clientType || 'ask',
      clientMigrationV2: true,
      connectedAt: 0,
      lastVerifiedAt: 0
    };

    this.cachedSession = session;
    if (typeof indexedDB !== 'undefined') {
      try {
        await set(WHATSAPP_AUTH_KEY, session);
      } catch {}
    }
    return true;
  }
}
