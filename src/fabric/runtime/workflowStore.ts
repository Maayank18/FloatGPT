/**
 * FloatGPT — Durable Workflow Store
 * 
 * Backed by IndexedDB (idb-keyval) so that multi-step agent workflows
 * survive page reloads, browser restarts, and crashes.
 * Provides step-level idempotency protection.
 */

import { get, set } from 'idb-keyval';
import { WorkflowPlan, ExecutionStep } from './types';

const WORKFLOW_STORE_KEY = 'floatgpt_durable_workflows';

export class WorkflowStore {
  private static cache: Map<string, WorkflowPlan> = new Map();
  private static isInitialized = false;

  private static async init(): Promise<void> {
    if (this.isInitialized) return;

    if (typeof window === 'undefined' && typeof (globalThis as any).window === 'undefined') {
      this.isInitialized = true;
      return;
    }

    try {
      const stored = await Promise.race([
        get<WorkflowPlan[]>(WORKFLOW_STORE_KEY),
        new Promise<null>((r) => setTimeout(() => r(null), 300))
      ]);
      if (stored && Array.isArray(stored)) {
        for (const plan of stored) {
          this.cache.set(plan.planId, plan);
        }
      }
    } catch (e) {
      console.warn('[WorkflowStore] Failed to load workflows from IndexedDB:', e);
    }

    this.isInitialized = true;
  }

  static async savePlan(plan: WorkflowPlan): Promise<void> {
    await this.init();
    const updated = { ...plan, updatedAt: Date.now() };
    this.cache.set(plan.planId, updated);

    if (typeof indexedDB !== 'undefined') {
      try {
        const allPlans = Array.from(this.cache.values());
        await set(WORKFLOW_STORE_KEY, allPlans);
      } catch (e) {
        console.error('[WorkflowStore] Failed to persist workflow to IndexedDB:', e);
      }
    }
  }

  static async getPlan(planId: string): Promise<WorkflowPlan | null> {
    await this.init();
    return this.cache.get(planId) || null;
  }

  static async getAllPlans(): Promise<WorkflowPlan[]> {
    await this.init();
    return Array.from(this.cache.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  static async updateStep(
    planId: string,
    stepIndex: number,
    updates: Partial<ExecutionStep>
  ): Promise<void> {
    await this.init();
    const plan = this.cache.get(planId);
    if (!plan) return;

    const step = plan.steps.find(s => s.stepIndex === stepIndex);
    if (step) {
      Object.assign(step, updates);
      await this.savePlan(plan);
    }
  }

  static async deletePlan(planId: string): Promise<void> {
    await this.init();
    this.cache.delete(planId);

    if (typeof indexedDB !== 'undefined') {
      try {
        const allPlans = Array.from(this.cache.values());
        await set(WORKFLOW_STORE_KEY, allPlans);
      } catch (e) {
        console.error('[WorkflowStore] Failed to delete workflow from IndexedDB:', e);
      }
    }
  }

  static async clear(): Promise<void> {
    this.cache.clear();
    this.isInitialized = true;

    if (typeof indexedDB !== 'undefined') {
      try {
        await set(WORKFLOW_STORE_KEY, []);
      } catch {}
    }
  }
}
