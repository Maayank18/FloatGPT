/**
 * FloatGPT — Messenger Agent: Persistent Audit Journal
 * 
 * Records every external messaging operation with stable operationId,
 * idempotencyKey, recipient details, timestamps, and verification states.
 * Stored locally in IndexedDB (idb-keyval), completely isolated from AI chat transcripts.
 */

import { get, set } from 'idb-keyval';
import { MessengerAuditRecord } from '../types/messenger.types';

const AUDIT_JOURNAL_KEY = 'floatgpt_messenger_audit_log';
const MAX_LOG_ENTRIES = 200;

export class MessagingAuditJournal {
  private static cache: MessengerAuditRecord[] | null = null;

  /**
   * Appends or updates an audit record in the journal.
   */
  static async record(entry: MessengerAuditRecord): Promise<void> {
    const records = await this.getAll();
    const existingIndex = records.findIndex(r => r.operationId === entry.operationId);

    if (existingIndex >= 0) {
      records[existingIndex] = { ...records[existingIndex], ...entry };
    } else {
      records.unshift(entry);
    }

    if (records.length > MAX_LOG_ENTRIES) {
      records.length = MAX_LOG_ENTRIES;
    }

    this.cache = records;
    if (typeof indexedDB !== 'undefined') {
      try {
        await set(AUDIT_JOURNAL_KEY, records);
      } catch (e) {
        console.error('[MessagingAuditJournal] Failed to persist audit record:', e);
      }
    }
  }

  /**
   * Retrieves all journal records sorted newest first.
   */
  static async getAll(limit: number = 50): Promise<MessengerAuditRecord[]> {
    if (this.cache) return this.cache.slice(0, limit);

    if (typeof window === 'undefined' && typeof (globalThis as any).window === 'undefined') {
      this.cache = [];
      return [];
    }

    try {
      const stored = await Promise.race([
        get<MessengerAuditRecord[]>(AUDIT_JOURNAL_KEY),
        new Promise<null>((r) => setTimeout(() => r(null), 300))
      ]);
      if (stored && Array.isArray(stored)) {
        this.cache = stored;
        return stored.slice(0, limit);
      }
    } catch (e) {
      console.warn('[MessagingAuditJournal] Failed to read from IndexedDB:', e);
    }

    this.cache = [];
    return [];
  }

  /**
   * Finds an audit record by operationId.
   */
  static async getByOperationId(operationId: string): Promise<MessengerAuditRecord | null> {
    const records = await this.getAll(MAX_LOG_ENTRIES);
    return records.find(r => r.operationId === operationId) || null;
  }

  /**
   * Finds an audit record by idempotencyKey to prevent duplicate sends.
   */
  static async findByIdempotencyKey(idempotencyKey: string): Promise<MessengerAuditRecord | null> {
    const records = await this.getAll(MAX_LOG_ENTRIES);
    return records.find(r => r.idempotencyKey === idempotencyKey) || null;
  }

  /**
   * Clears all audit journal records (wipes stuck idempotency records).
   */
  static async clearAll(): Promise<void> {
    this.cache = [];
    if (typeof indexedDB !== 'undefined') {
      try {
        await set(AUDIT_JOURNAL_KEY, []);
      } catch (e) {
        console.warn('[MessagingAuditJournal] Failed to clear IndexedDB:', e);
      }
    }
  }
}
