/**
 * FloatGPT — Messenger Agent: Persistent Message Scheduler
 * 
 * Manages time-based message dispatch, periodic polling,
 * and robust system restart / sleep-wake recovery via IndexedDB.
 */

import {
  ScheduledMessageJob,
  MessagePlatform,
  ResolvedRecipient,
  MessagePayload,
  SendResult
} from '../types/messenger.types';
import { MessageJobStore } from './MessageJobStore';
import { MessageExecutor } from '../core/MessageExecutor';

export class MessageScheduler {
  private static pollTimer: NodeJS.Timeout | null = null;
  private static isInitialized = false;
  private static isProcessing = false;
  private static exactTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /**
   * Initializes the scheduler engine and executes restart recovery.
   */
  static async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log('[MessageScheduler] Initializing persistent scheduler engine...');

    // 1. Reconcile missed / overdue jobs after restart or wake
    await this.reconcileMissedJobs();
    const pending = await MessageJobStore.getPendingJobs();
    for (const job of pending) {
      if (job.status === 'SCHEDULED' && job.scheduledEpochMs > Date.now()) {
        this.armExactTimer(job);
      }
    }

    // Backup poll only — exact timers fire on schedule. Avoid 5s IndexedDB churn.
    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => {
        this.processDueJobs().catch(e => {
          console.error('[MessageScheduler] Polling error:', e);
        });
      }, 30_000);
    }
  }

  /**
   * Test helper: reset singleton timers so overdue recovery can be re-run.
   */
  static resetForTesting(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isInitialized = false;
    this.isProcessing = false;
    for (const timer of this.exactTimers.values()) clearTimeout(timer);
    this.exactTimers.clear();
  }

  /**
   * Schedules a new message for future dispatch.
   */
  static async schedule(params: {
    platform: MessagePlatform;
    recipient: ResolvedRecipient;
    message: MessagePayload;
    scheduledAt: string;
    timezone: string;
    clientType?: 'desktop' | 'web';
  }): Promise<ScheduledMessageJob> {
    const epoch = new Date(params.scheduledAt).getTime();
    if (!Number.isFinite(epoch)) {
      throw new Error('Invalid schedule time.');
    }

    const operationId = `msgop_sched_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const idempotencyKey = MessageExecutor.generateIdempotencyKey(
      params.platform,
      params.recipient.identifier,
      params.message.content,
      params.scheduledAt
    );

    const job: ScheduledMessageJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      operationId,
      idempotencyKey,
      platform: params.platform,
      recipient: params.recipient,
      message: params.message,
      scheduledAt: params.scheduledAt,
      scheduledEpochMs: epoch,
      timezone: params.timezone,
      status: 'SCHEDULED',
      attemptCount: 0,
      maxRetries: 3,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      clientType: params.clientType
    };

    await MessageJobStore.saveJob(job);
    console.log(`[MessageScheduler] Scheduled job "${job.id}" for ${params.scheduledAt} (in ${Math.round((epoch - Date.now()) / 1000)}s)`);

    await this.init();
    this.armExactTimer(job);

    return job;
  }

  private static armExactTimer(job: ScheduledMessageJob): void {
    const existing = this.exactTimers.get(job.id);
    if (existing) clearTimeout(existing);
    const delay = job.scheduledEpochMs - Date.now();
    if (delay <= 0) return;
    const capped = Math.min(delay, 2147483647);
    const timer = setTimeout(() => {
      this.exactTimers.delete(job.id);
      this.executeJob(job).catch((e) => console.error('[MessageScheduler] Exact timer error:', e));
    }, capped);
    this.exactTimers.set(job.id, timer);
  }

  /**
   * Reconciles missed jobs after system restarts or sleep/wake cycles.
   * Jobs only slightly overdue (poll lag) fire immediately. Jobs missed
   * while the machine was asleep wait for an explicit user confirmation.
   */
  static async reconcileMissedJobs(): Promise<void> {
    const pending = await MessageJobStore.getPendingJobs();
    const now = Date.now();
    const POLL_SLACK_MS = 45 * 1000;
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    for (const job of pending) {
      if (job.scheduledEpochMs <= now) {
        const overdueMs = now - job.scheduledEpochMs;

        if (overdueMs > TWENTY_FOUR_HOURS_MS) {
          console.warn(`[MessageScheduler] Job "${job.id}" missed by >24h. Marking EXPIRED.`);
          await MessageJobStore.updateJobStatus(job.id, 'EXPIRED', 'Message expired due to prolonged system downtime.');
        } else if (overdueMs <= POLL_SLACK_MS) {
          console.log(`[MessageScheduler] Dispatching due job "${job.id}" (overdue by ${Math.round(overdueMs / 1000)}s).`);
          await this.executeJob(job);
        } else {
          console.warn(`[MessageScheduler] Job "${job.id}" missed during sleep/wake. Marking OVERDUE_PENDING.`);
          await MessageJobStore.updateJobStatus(
            job.id,
            'OVERDUE_PENDING',
            `Scheduled for ${new Date(job.scheduledEpochMs).toLocaleString()} while the device was asleep.`
          );
        }
      }
    }
  }

  /**
   * Processes all currently due jobs.
   */
  private static async processDueJobs(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pending = await MessageJobStore.getPendingJobs();
      const now = Date.now();

      for (const job of pending) {
        if (job.status === 'SCHEDULED' && job.scheduledEpochMs <= now) {
          await this.executeJob(job);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Executes a scheduled message job (also used for overdue "send now").
   */
  static async executeJob(job: ScheduledMessageJob): Promise<SendResult> {
    const latest = await MessageJobStore.getJob(job.id);
    if (!latest || latest.status === 'VERIFIED' || latest.status === 'SENT' || latest.status === 'CANCELLED' || latest.status === 'EXPIRED') {
      return {
        success: latest?.status === 'VERIFIED' || latest?.status === 'SENT',
        operationId: job.operationId,
        status: latest?.status || 'FAILED',
        timestamp: Date.now(),
        platform: job.platform,
        recipient: job.recipient
      };
    }

    const timer = this.exactTimers.get(job.id);
    if (timer) {
      clearTimeout(timer);
      this.exactTimers.delete(job.id);
    }

    await MessageJobStore.updateJobStatus(job.id, 'EXECUTING');
    job.attemptCount += 1;
    job.lastAttemptAt = Date.now();

    const sendResult = await MessageExecutor.execute(
      job.platform,
      job.recipient,
      job.message,
      {
        operationId: job.operationId,
        idempotencyKey: job.idempotencyKey,
        clientType: job.clientType || 'web'
      }
    );

    if (sendResult.success) {
      await MessageJobStore.updateJobStatus(job.id, 'VERIFIED');
      this.notifyUser(
        'Scheduled WhatsApp message delivered',
        `Delivered to ${job.recipient.name}.`
      );
    } else {
      await MessageJobStore.updateJobStatus(job.id, 'FAILED', sendResult.error);
    }

    return sendResult;
  }

  private static notifyUser(title: string, body: string): void {
    try {
      if (typeof Notification !== 'undefined' && typeof Notification.permission === 'string' && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    } catch {}
  }

  /**
   * Cancels a scheduled job by ID.
   */
  static async cancelJob(jobId: string): Promise<boolean> {
    const timer = this.exactTimers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.exactTimers.delete(jobId);
    }
    return await MessageJobStore.cancelJob(jobId);
  }

  /**
   * Retrieves all currently pending jobs.
   */
  static async getPending(): Promise<ScheduledMessageJob[]> {
    const due = await MessageJobStore.getPendingJobs();
    const overdue = await MessageJobStore.getOverduePendingJobs();
    return [...overdue, ...due];
  }

  static async getOverduePending(): Promise<ScheduledMessageJob[]> {
    return await MessageJobStore.getOverduePendingJobs();
  }

  /**
   * Retrieves all jobs.
   */
  static async getAll(): Promise<ScheduledMessageJob[]> {
    return await MessageJobStore.getAll();
  }
}
