/**
 * FloatGPT — Messenger Agent: Persistent Message Job Store
 * 
 * Backed by IndexedDB (idb-keyval) so that scheduled messaging jobs
 * survive Electron restarts, OS reboots, sleep/wake cycles, and crashes.
 */

import { get, set } from 'idb-keyval';
import { ScheduledMessageJob, MessageExecutionStatus } from '../types/messenger.types';

const JOBS_STORE_KEY = 'floatgpt_scheduled_message_jobs';

export class MessageJobStore {
  private static cache: ScheduledMessageJob[] | null = null;

  /**
   * Saves or updates a scheduled message job in IndexedDB.
   */
  static async saveJob(job: ScheduledMessageJob): Promise<void> {
    const jobs = await this.getAll();
    const index = jobs.findIndex(j => j.id === job.id);

    if (index >= 0) {
      jobs[index] = { ...jobs[index], ...job, updatedAt: Date.now() };
    } else {
      jobs.push({ ...job, updatedAt: Date.now() });
    }

    this.cache = jobs;
    if (typeof indexedDB !== 'undefined') {
      try {
        await set(JOBS_STORE_KEY, jobs);
      } catch (e) {
        console.error('[MessageJobStore] Failed to persist job to IndexedDB:', e);
      }
    }
  }

  /**
   * Loads all scheduled jobs from storage.
   */
  static async getAll(): Promise<ScheduledMessageJob[]> {
    if (this.cache) return this.cache;

    if (typeof window === 'undefined' && typeof (globalThis as any).window === 'undefined') {
      this.cache = [];
      return this.cache;
    }

    try {
      const stored = await Promise.race([
        get<ScheduledMessageJob[]>(JOBS_STORE_KEY),
        new Promise<null>((r) => setTimeout(() => r(null), 300))
      ]);
      if (stored && Array.isArray(stored)) {
        this.cache = stored;
        return stored;
      }
    } catch (e) {
      console.warn('[MessageJobStore] Failed to read jobs from IndexedDB:', e);
    }

    this.cache = [];
    return [];
  }

  /**
   * Retrieves a specific job by its ID.
   */
  static async getJob(id: string): Promise<ScheduledMessageJob | null> {
    const jobs = await this.getAll();
    return jobs.find(j => j.id === id) || null;
  }

  /**
   * Returns all pending jobs eligible for execution or waiting for scheduled time.
   */
  static async getPendingJobs(): Promise<ScheduledMessageJob[]> {
    const jobs = await this.getAll();
    return jobs.filter(j => j.status === 'SCHEDULED' || j.status === 'QUEUED' || j.status === 'RETRYING');
  }

  static async getOverduePendingJobs(): Promise<ScheduledMessageJob[]> {
    const jobs = await this.getAll();
    return jobs.filter(j => j.status === 'OVERDUE_PENDING');
  }

  /**
   * Updates status of a job.
   */
  static async updateJobStatus(id: string, status: MessageExecutionStatus, error?: string): Promise<void> {
    const job = await this.getJob(id);
    if (!job) return;

    job.status = status;
    if (error) job.error = error;
    job.updatedAt = Date.now();
    await this.saveJob(job);
  }

  /**
   * Cancels a scheduled job.
   */
  static async cancelJob(id: string): Promise<boolean> {
    const job = await this.getJob(id);
    if (!job) return false;

    if (job.status === 'SENT' || job.status === 'VERIFIED') {
      return false; // Cannot cancel an already delivered message
    }

    job.status = 'CANCELLED';
    job.updatedAt = Date.now();
    await this.saveJob(job);
    return true;
  }

  /**
   * Deletes a job from storage.
   */
  static async deleteJob(id: string): Promise<boolean> {
    const jobs = await this.getAll();
    const filtered = jobs.filter(j => j.id !== id);
    if (filtered.length !== jobs.length) {
      this.cache = filtered;
      if (typeof indexedDB !== 'undefined') {
        try {
          await set(JOBS_STORE_KEY, filtered);
        } catch {}
      }
      return true;
    }
    return false;
  }
}
