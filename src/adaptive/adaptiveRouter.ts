/**
 * FloatGPT — Adaptive Model Router
 * 
 * Optimizes AI invocations by dynamically selecting between
 * FAST_PATH (zero tokens/static templates), FAST_TIER (low latency/cost),
 * and REASONING_TIER (multi-step planning/high complexity) based on task domain
 * and historical performance metrics.
 */

import { ModelTier, TaskPerformanceRecord } from './types';

export interface RouteSelection {
  tier: ModelTier;
  rationale: string;
  recommendedModel?: string;
}

export class AdaptiveRouter {
  private static metrics: TaskPerformanceRecord[] = [];

  /**
   * Evaluates task characteristics and returns the optimal ModelTier.
   */
  static selectTier(
    taskDomain: string,
    prompt: string,
    options?: {
      requiresReasoning?: boolean;
      stepCount?: number;
      isDeterministic?: boolean;
    }
  ): RouteSelection {
    const trimmed = prompt.trim().toLowerCase();

    // 1. Zero-token / Instant Fast Path
    if (options?.isDeterministic || 
        trimmed.startsWith('ping') || 
        trimmed.startsWith('help') || 
        trimmed === 'status' || 
        trimmed === 'where was i' || 
        trimmed === 'what matters now') {
      return {
        tier: 'FAST_PATH',
        rationale: 'Deterministic command or lightweight status query qualifies for instant zero-token handling.'
      };
    }

    // 2. High-complexity Reasoning Tier
    if (options?.requiresReasoning || 
        (options?.stepCount && options.stepCount > 3) ||
        taskDomain === 'ARCHITECTURE_SYNTHESIS' ||
        taskDomain === 'SECURITY_AUDIT' ||
        taskDomain === 'MULTI_STEP_AGENT_PLANNING' ||
        trimmed.includes('refactor entire') ||
        trimmed.includes('design architecture') ||
        prompt.length > 2500) {
      return {
        tier: 'REASONING_TIER',
        rationale: 'High complexity, multi-step orchestration, or extensive context requires reasoning-grade model.',
        recommendedModel: 'claude-3-7-sonnet'
      };
    }

    // 3. Historical performance check: If domain has < 75% success on FAST_TIER, upgrade to REASONING
    const domainStats = this.getPerformanceStats(taskDomain);
    if (domainStats.count >= 3 && domainStats.successRate < 0.75) {
      return {
        tier: 'REASONING_TIER',
        rationale: `Historical success rate in domain "${taskDomain}" is low (${Math.round(domainStats.successRate * 100)}%). Upgrading to reasoning tier for reliability.`,
        recommendedModel: 'gpt-4o'
      };
    }

    // 4. Default: Fast Tier (Groq / Gemini Flash / Lightweight)
    return {
      tier: 'FAST_TIER',
      rationale: 'Standard task execution, lightweight summarization, or single-step action optimal for fast low-latency tier.',
      recommendedModel: 'gemini-1.5-flash'
    };
  }

  /**
   * Records execution telemetry for closed-loop routing optimization.
   */
  static recordMetric(record: TaskPerformanceRecord): void {
    this.metrics.push(record);
    // Keep bounded history (last 500 records)
    if (this.metrics.length > 500) {
      this.metrics.shift();
    }
  }

  /**
   * Aggregates historical metrics for a given domain or overall.
   */
  static getPerformanceStats(domain?: string): {
    averageLatencyMs: number;
    successRate: number;
    count: number;
  } {
    const filtered = domain 
      ? this.metrics.filter(m => m.taskDomain === domain)
      : this.metrics;

    if (filtered.length === 0) {
      return { averageLatencyMs: 0, successRate: 1.0, count: 0 };
    }

    const totalLatency = filtered.reduce((sum, m) => sum + m.latencyMs, 0);
    const successCount = filtered.filter(m => m.success).length;

    return {
      averageLatencyMs: Math.round(totalLatency / filtered.length),
      successRate: Math.round((successCount / filtered.length) * 100) / 100,
      count: filtered.length
    };
  }

  static clear(): void {
    this.metrics = [];
  }
}
