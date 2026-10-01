/**
 * FloatGPT — Adaptive Intelligence: Types & Schemas
 * 
 * Defines schemas for the Evidence Engine, Trust Hierarchy,
 * Preference Learning, Proactive Signals, Recommendations, and Continuity.
 */

export type EvidenceSource = 
  | 'USER_EXPLICIT'
  | 'USER_CONFIRMED'
  | 'WORKFLOW_RESULT'
  | 'SYSTEM_OBSERVED'
  | 'DERIVED'
  | 'MODEL_INFERENCE'
  | 'EXTERNAL_CONTENT';

export interface EvidenceRecord {
  evidenceId: string;
  source: EvidenceSource;
  sourceReference?: string;
  observationType: string;
  observation: Record<string, any>;
  confidence: number; // 0.0 to 1.0
  timestamp: number;
  scope: 'PERSONAL' | 'WORKSPACE' | 'THREAD';
  expiration?: number;
}

export interface CandidateLearning {
  id: string;
  type: 'WORKFLOW_PATTERN' | 'PREFERENCE' | 'DECISION';
  key: string;
  value: any;
  evidenceIds: string[];
  confidence: number;
  frequency: number;
  status: 'CANDIDATE' | 'CONFIRMED' | 'REJECTED' | 'INVALIDATED';
  proposedRecommendation?: string;
  createdAt: number;
  updatedAt: number;
}

export interface LearnedPreference {
  key: string;
  value: any;
  scope: string;
  source: 'USER_EXPLICIT' | 'OBSERVED';
  confidence: number;
  updatedAt: number;
}

export type ProactiveSignalType = 
  | 'DEADLINE_APPROACHING'
  | 'BLOCKER_DETECTED'
  | 'GOAL_DRIFT'
  | 'REPEATED_WORKFLOW'
  | 'STALE_COMMITMENT'
  | 'NEW_RELEVANT_RESOURCE';

export interface ProactiveSignal {
  id: string;
  type: ProactiveSignalType;
  title: string;
  message: string;
  relevance: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  potentialBenefit: number; // 0.0 to 1.0
  interruptionCost: number; // 0.0 to 1.0
  proactiveValue: number; // derived score
  actionPayload?: Record<string, any>;
  timestamp: number;
}

export type RecommendationType = 
  | 'AUTOMATION_PROPOSAL'
  | 'NEXT_ACTION'
  | 'BLOCKER_RESOLUTION'
  | 'WORKFLOW_OPTIMIZATION';

export interface RecommendationCard {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  rationale: string;
  evidenceIds: string[];
  confidence: number;
  actionLabel: string;
  actionSkillId?: string;
  actionParameters?: Record<string, any>;
  status: 'ACTIVE' | 'ACCEPTED' | 'DISMISSED' | 'SNOOZED' | 'REJECTED';
  createdAt: number;
}

export type ModelTier = 'FAST_PATH' | 'FAST_TIER' | 'REASONING_TIER';

export interface TaskPerformanceRecord {
  taskDomain: string;
  modelTier: ModelTier;
  latencyMs: number;
  tokenCost: number;
  success: boolean;
  timestamp: number;
}
