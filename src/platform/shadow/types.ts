/**
 * FloatGPT — Shadow AI & Cross-System Reasoning Types
 * 
 * Defines schemas for cross-system telemetry signals, causal correlation
 * hypotheses with calibrated uncertainty, and organizational risk assessments.
 */

export type SignalSource = 
  | 'GITHUB'
  | 'ZENDESK'
  | 'STRIPE'
  | 'SENTRY'
  | 'JIRA'
  | 'LINEAR'
  | 'SLACK';

export interface SystemSignal {
  id: string;
  source: SignalSource;
  entityId: string;
  metric: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface CrossSystemCorrelation {
  id: string;
  signals: SystemSignal[];
  hypothesis: string;
  confidence: number; // 0.0 to 1.0 (calibrated uncertainty)
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rationale: string;
  suggestedAction?: string;
  timestamp: number;
}

export type OrgRiskCategory = 
  | 'DEADLINE'
  | 'BOTTLENECK'
  | 'CUSTOMER_IMPACT'
  | 'REVENUE';

export interface OrgRiskAssessment {
  id: string;
  category: OrgRiskCategory;
  score: number; // 0 to 100
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedInitiatives: string[];
  rationale: string;
  suggestedRemediation: string;
  timestamp: number;
}
