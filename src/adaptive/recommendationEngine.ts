/**
 * FloatGPT — Recommendation Engine
 * 
 * Central catalog of actionable, explainable suggestions.
 * Evaluates candidates, attaches evidence chains, and captures feedback.
 */

import { RecommendationCard, RecommendationType } from './types';
import { CandidateLearning } from './types';
import { EvidenceEngine } from './evidenceEngine';

export class RecommendationEngine {
  private static cards: Map<string, RecommendationCard> = new Map();

  /**
   * Generates a recommendation card from a learned workflow candidate.
   */
  static fromWorkflowCandidate(candidate: CandidateLearning): RecommendationCard {
    const cardId = `rec_${candidate.id}`;
    const card: RecommendationCard = {
      id: cardId,
      type: 'AUTOMATION_PROPOSAL',
      title: `Automate "${candidate.key}"`,
      description: candidate.proposedRecommendation || `You frequently execute this workflow. Would you like to schedule it?`,
      rationale: `Detected ${candidate.frequency} completed executions with ${Math.round(candidate.confidence * 100)}% pattern stability.`,
      evidenceIds: candidate.evidenceIds,
      confidence: candidate.confidence,
      actionLabel: 'Enable Automation',
      actionSkillId: candidate.key,
      actionParameters: candidate.value,
      status: 'ACTIVE',
      createdAt: Date.now()
    };

    this.cards.set(cardId, card);
    return card;
  }

  /**
   * Creates a next-action recommendation card.
   */
  static createNextAction(params: {
    title: string;
    description: string;
    rationale: string;
    evidenceIds?: string[];
    confidence?: number;
    skillId?: string;
  }): RecommendationCard {
    const cardId = `rec_act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const card: RecommendationCard = {
      id: cardId,
      type: 'NEXT_ACTION',
      title: params.title,
      description: params.description,
      rationale: params.rationale,
      evidenceIds: params.evidenceIds || [],
      confidence: params.confidence || 0.85,
      actionLabel: 'Execute Next Step',
      actionSkillId: params.skillId,
      status: 'ACTIVE',
      createdAt: Date.now()
    };

    this.cards.set(cardId, card);
    return card;
  }

  static get(cardId: string): RecommendationCard | null {
    return this.cards.get(cardId) || null;
  }

  static getAll(status: RecommendationCard['status'] = 'ACTIVE'): RecommendationCard[] {
    return Array.from(this.cards.values()).filter(c => c.status === status);
  }

  /**
   * Answers "Why are you suggesting this?" with concrete evidence descriptions.
   */
  static explainRationale(cardId: string): string {
    const card = this.cards.get(cardId);
    if (!card) return 'Recommendation not found.';

    if (card.evidenceIds.length === 0) {
      return `Rationale: ${card.rationale}`;
    }

    const evidenceItems = card.evidenceIds
      .map(id => EvidenceEngine.get(id))
      .filter((e): e is NonNullable<typeof e> => e !== null);

    const evidenceList = evidenceItems.map(
      e => `- [${e.source}] ${e.observationType}: ${JSON.stringify(e.observation)}`
    ).join('\n');

    return `### Why FloatGPT is suggesting this:\n${card.rationale}\n\n**Underlying Evidence:**\n${evidenceList || '- Verified work state milestones'}`;
  }

  /**
   * Captures user response and updates card lifecycle.
   */
  static respond(
    cardId: string,
    action: 'ACCEPTED' | 'DISMISSED' | 'SNOOZED' | 'REJECTED'
  ): boolean {
    const card = this.cards.get(cardId);
    if (!card) return false;

    card.status = action;
    this.cards.set(cardId, card);
    return true;
  }

  static clear(): void {
    this.cards.clear();
  }
}
