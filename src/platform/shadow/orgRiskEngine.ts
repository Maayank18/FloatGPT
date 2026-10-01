/**
 * FloatGPT — Organizational Risk & Bottleneck Evaluator
 * 
 * Assesses structural risks, cross-team dependency bottlenecks,
 * and delivery slippage across organization initiatives.
 */

import { OrgRiskAssessment, OrgRiskCategory } from './types';

export class OrgRiskEngine {
  /**
   * Assesses organizational risks from work entities, cross-team dependencies, and external metrics.
   */
  static assessRisks(params: {
    tasks?: Array<{ id: string; title: string; deadlineAt?: number; status?: string; projectId?: string }>;
    dependencies?: Array<{ sourceTaskId: string; blockedTaskId: string; initiative?: string }>;
    unresolvedTicketCount?: number;
    now?: number;
  }): OrgRiskAssessment[] {
    const assessments: OrgRiskAssessment[] = [];
    const now = params.now ?? Date.now();

    // 1. Dependency Bottleneck Analysis
    const dependencyCounts = new Map<string, number>();
    for (const dep of params.dependencies || []) {
      const count = (dependencyCounts.get(dep.sourceTaskId) || 0) + 1;
      dependencyCounts.set(dep.sourceTaskId, count);
    }

    for (const [taskId, blockedCount] of dependencyCounts.entries()) {
      if (blockedCount >= 2) {
        assessments.push({
          id: `risk_btn_${Date.now()}_${taskId}`,
          category: 'BOTTLENECK',
          score: Math.min(50 + blockedCount * 15, 95),
          severity: blockedCount >= 3 ? 'CRITICAL' : 'HIGH',
          affectedInitiatives: params.dependencies?.filter(d => d.sourceTaskId === taskId).map(d => d.initiative || d.blockedTaskId) || [],
          rationale: `Task "${taskId}" is an organizational bottleneck blocking ${blockedCount} downstream deliverables.`,
          suggestedRemediation: `Swarm on "${taskId}" or decouple blocked initiatives to prevent delivery gridlock.`,
          timestamp: now
        });
      }
    }

    // 2. Critical Delivery Deadline Risks
    const overdueOrCriticalTasks = (params.tasks || []).filter(t => {
      if (t.status === 'Completed' || t.status === 'Archived') return false;
      if (!t.deadlineAt) return false;
      return t.deadlineAt - now < 12 * 60 * 60 * 1000; // < 12 hours or overdue
    });

    if (overdueOrCriticalTasks.length > 0) {
      assessments.push({
        id: `risk_dead_${Date.now()}`,
        category: 'DEADLINE',
        score: Math.min(60 + overdueOrCriticalTasks.length * 10, 95),
        severity: 'CRITICAL',
        affectedInitiatives: overdueOrCriticalTasks.map(t => t.projectId || t.title),
        rationale: `${overdueOrCriticalTasks.length} initiative tasks have breached or imminent deadlines (< 12 hours).`,
        suggestedRemediation: 'Reallocate team resources immediately to critical path milestones.',
        timestamp: now
      });
    }

    // 3. Customer Escalation Impact
    if (params.unresolvedTicketCount && params.unresolvedTicketCount > 10) {
      assessments.push({
        id: `risk_cust_${Date.now()}`,
        category: 'CUSTOMER_IMPACT',
        score: Math.min(40 + params.unresolvedTicketCount * 3, 90),
        severity: params.unresolvedTicketCount > 25 ? 'CRITICAL' : 'HIGH',
        affectedInitiatives: ['Customer Operations', 'Product Quality'],
        rationale: `High unresolved customer support backlog (${params.unresolvedTicketCount} open tickets).`,
        suggestedRemediation: 'Initiate support blitz and deploy emergency defect patches.',
        timestamp: now
      });
    }

    return assessments.sort((a, b) => b.score - a.score);
  }
}
