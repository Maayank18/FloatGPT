/**
 * FloatGPT — Proactive Signal Engine & Anti-Spam Controller
 * 
 * Generates context-aware proactive signals (deadlines, blockers, goal drift)
 * and ranks them with interruption budgeting and dismissal decay.
 */

import { ProactiveSignal, ProactiveSignalType } from './types';

export class ProactiveEngine {
  private static dismissals: Map<ProactiveSignalType, number> = new Map();
  private static readonly SURFACING_THRESHOLD = 0.30; // Minimum net value to surface to user

  /**
   * Generates and ranks proactive signals from workspace work state.
   */
  static evaluateSignals(state: {
    tasks?: Array<{ id: string; title: string; deadlineAt?: number; status?: string; dependencies?: string[] }>;
    activeGoal?: { id: string; title: string; progress: number };
    recentActivities?: string[];
    currentHour?: number;
  }): ProactiveSignal[] {
    const rawSignals: ProactiveSignal[] = [];
    const now = Date.now();

    // 1. Deadline Approaching Signals (< 24 hours)
    for (const task of state.tasks || []) {
      if (task.status === 'Completed' || task.status === 'Archived') continue;
      if (task.deadlineAt && task.deadlineAt > now && task.deadlineAt - now < 24 * 60 * 60 * 1000) {
        const hoursRemaining = Math.max(1, Math.round((task.deadlineAt - now) / (60 * 60 * 1000)));
        rawSignals.push(this.buildSignal({
          type: 'DEADLINE_APPROACHING',
          title: `Deadline Approaching: ${task.title}`,
          message: `Due in ${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''}. Would you like to prioritize this now?`,
          relevance: 0.90,
          confidence: 0.95,
          potentialBenefit: 0.85,
          interruptionCost: 0.20,
          actionPayload: { taskId: task.id }
        }));
      }
    }

    // 2. Blocker Detected Signals
    for (const task of state.tasks || []) {
      if (task.status === 'Completed' || task.status === 'Archived') continue;
      if (task.dependencies && task.dependencies.length > 0) {
        rawSignals.push(this.buildSignal({
          type: 'BLOCKER_DETECTED',
          title: `Unresolved Blocker on: ${task.title}`,
          message: `This item is blocked by ${task.dependencies.length} dependent task(s).`,
          relevance: 0.90,
          confidence: 0.95,
          potentialBenefit: 0.85,
          interruptionCost: 0.20,
          actionPayload: { taskId: task.id, dependencies: task.dependencies }
        }));
      }
    }

    // 3. Goal Drift Detection
    if (state.activeGoal && state.recentActivities && state.recentActivities.length >= 3) {
      const driftSignal = this.checkGoalDrift(state.activeGoal.title, state.recentActivities);
      if (driftSignal) {
        rawSignals.push(driftSignal);
      }
    }

    // Filter by quiet hours and net proactive value
    const hour = state.currentHour !== undefined ? state.currentHour : new Date().getHours();
    const isQuietHour = hour >= 22 || hour < 7;

    return rawSignals
      .filter(s => {
        if (isQuietHour && s.proactiveValue < 0.60) return false;
        return s.proactiveValue >= this.SURFACING_THRESHOLD;
      })
      .sort((a, b) => b.proactiveValue - a.proactiveValue);
  }

  /**
   * Compares declared goal against recent activities to detect goal drift.
   */
  static checkGoalDrift(goalTitle: string, recentActivities: string[]): ProactiveSignal | null {
    const goalTokens = goalTitle.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (goalTokens.length === 0) return null;

    let matchingCount = 0;
    for (const act of recentActivities) {
      const lower = act.toLowerCase();
      if (goalTokens.some(tok => lower.includes(tok))) {
        matchingCount++;
      }
    }

    // If less than 25% of recent activities relate to the declared goal, signal gentle drift
    const alignmentRatio = matchingCount / recentActivities.length;
    if (alignmentRatio < 0.25) {
      return this.buildSignal({
        type: 'GOAL_DRIFT',
        title: 'Goal Alignment Observation',
        message: `Your declared goal is "${goalTitle}", but recent actions have focused on other tasks. Would you like to refocus on your main goal?`,
        relevance: 0.75,
        confidence: 0.80,
        potentialBenefit: 0.70,
        interruptionCost: 0.30
      });
    }

    return null;
  }

  /**
   * Records a user dismissal and applies anti-spam category decay.
   */
  static recordDismissal(type: ProactiveSignalType): void {
    const count = (this.dismissals.get(type) || 0) + 1;
    this.dismissals.set(type, count);
  }

  private static buildSignal(params: {
    type: ProactiveSignalType;
    title: string;
    message: string;
    relevance: number;
    confidence: number;
    potentialBenefit: number;
    interruptionCost: number;
    actionPayload?: Record<string, any>;
  }): ProactiveSignal {
    const dismissCount = this.dismissals.get(params.type) || 0;
    // Anti-spam decay penalty: each dismissal increases cost
    const spamPenalty = Math.min(dismissCount * 0.20, 0.60);
    const effectiveCost = Math.min(params.interruptionCost + spamPenalty, 1.0);

    // Value = (Relevance * Confidence * Benefit) - InterruptionCost
    const proactiveValue = (params.relevance * params.confidence * params.potentialBenefit) - effectiveCost;

    return {
      id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: params.type,
      title: params.title,
      message: params.message,
      relevance: params.relevance,
      confidence: params.confidence,
      potentialBenefit: params.potentialBenefit,
      interruptionCost: effectiveCost,
      proactiveValue: Math.round(proactiveValue * 100) / 100,
      actionPayload: params.actionPayload,
      timestamp: Date.now()
    };
  }

  static clear(): void {
    this.dismissals.clear();
  }
}
