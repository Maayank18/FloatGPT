/**
 * FloatGPT — LinkedIn Messenger Agent: Authentication & Session Store
 * 
 * Persistent LinkedIn credentials and connection state backed by IndexedDB.
 */

import { get, set } from 'idb-keyval';
import { AuthResult, AuthStatus } from '../types/messenger.types';

const LINKEDIN_AUTH_KEY = 'floatgpt_linkedin_auth_session';

export interface LinkedInSessionData {
  status: AuthStatus;
  profileHandle: string;
  accountName: string;
  accessToken?: string;
  connectedAt: number;
}

export class LinkedInAuth {
  private static cachedSession: LinkedInSessionData | null = null;

  private static async loadSession(): Promise<LinkedInSessionData | null> {
    if (this.cachedSession) return this.cachedSession;

    try {
      const stored = await Promise.race([
        get<LinkedInSessionData>(LINKEDIN_AUTH_KEY),
        new Promise<null>((r) => setTimeout(() => r(null), 300))
      ]);
      if (stored) {
        // Migration safeguard: if the stored session is the old hardcoded demo profile, reset it to NOT_CONNECTED
        if (stored.profileHandle === 'mayank-garg' && stored.accountName === 'Mayank Garg (LinkedIn)' && !stored.accessToken) {
          const unauthed: LinkedInSessionData = {
            status: 'NOT_CONNECTED',
            profileHandle: '',
            accountName: '',
            connectedAt: 0
          };
          this.cachedSession = unauthed;
          try { await set(LINKEDIN_AUTH_KEY, unauthed); } catch {}
          return unauthed;
        }

        this.cachedSession = stored;
        return stored;
      }
    } catch (e) {
      console.warn('[LinkedInAuth] Failed to read auth session from IndexedDB:', e);
    }

    // Default clean state: NOT_CONNECTED (User provides their real profile handle/URL)
    const defaultSession: LinkedInSessionData = {
      status: 'NOT_CONNECTED',
      profileHandle: '',
      accountName: '',
      connectedAt: 0
    };

    this.cachedSession = defaultSession;
    return defaultSession;
  }

  /**
   * Helper for automated test suites to seed an active test session.
   */
  static async seedForTesting(): Promise<void> {
    const testSession: LinkedInSessionData = {
      status: 'CONNECTED',
      profileHandle: 'test-linkedin-user',
      accountName: 'Test LinkedIn Session',
      connectedAt: Date.now()
    };
    this.cachedSession = testSession;
    if (typeof indexedDB !== 'undefined') {
      try { await set(LINKEDIN_AUTH_KEY, testSession); } catch {}
    }
  }

  static async isAuthenticated(): Promise<boolean> {
    const session = await this.loadSession();
    return session !== null && session.status === 'CONNECTED' && Boolean(session.profileHandle?.trim());
  }

  static async getSessionData(): Promise<LinkedInSessionData | null> {
    return this.loadSession();
  }

  static async getAccountInfo(): Promise<AuthResult> {
    const session = await this.loadSession();
    if (!session || session.status !== 'CONNECTED') {
      return {
        success: false,
        status: 'NOT_CONNECTED',
        platform: 'linkedin',
        error: 'LinkedIn account is not connected.'
      };
    }

    return {
      success: true,
      status: session.status,
      platform: 'linkedin',
      accountName: session.accountName,
      accountId: session.profileHandle,
      connectedAt: session.connectedAt
    };
  }

  static async connectAccount(params: { profileHandle: string; accountName?: string; accessToken?: string }): Promise<AuthResult> {
    const session: LinkedInSessionData = {
      status: 'CONNECTED',
      profileHandle: params.profileHandle.trim(),
      accountName: params.accountName?.trim() || `LinkedIn (${params.profileHandle})`,
      accessToken: params.accessToken?.trim(),
      connectedAt: Date.now()
    };

    this.cachedSession = session;
    if (typeof indexedDB !== 'undefined') {
      try {
        await set(LINKEDIN_AUTH_KEY, session);
      } catch {}
    }

    return {
      success: true,
      status: 'CONNECTED',
      platform: 'linkedin',
      accountName: session.accountName,
      accountId: session.profileHandle,
      connectedAt: session.connectedAt
    };
  }

  static async disconnect(): Promise<boolean> {
    const session: LinkedInSessionData = {
      status: 'NOT_CONNECTED',
      profileHandle: '',
      accountName: '',
      connectedAt: 0
    };

    this.cachedSession = session;
    if (typeof indexedDB !== 'undefined') {
      try {
        await set(LINKEDIN_AUTH_KEY, session);
      } catch {}
    }
    return true;
  }
}
