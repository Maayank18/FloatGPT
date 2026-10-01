/**
 * FloatGPT — Skill System: Types & Contracts
 * 
 * Defines declarative, versioned, reusable skills, parameter schemas,
 * lifecycle states, and verification criteria.
 */

export type SkillCategory = 
  | 'REPORTING'
  | 'DOCUMENTATION'
  | 'MEETING'
  | 'TASK_MANAGEMENT'
  | 'INTEGRATION'
  | 'DEVELOPMENT';

export type SkillLifecycle = 
  | 'DRAFT'
  | 'ACTIVE'
  | 'DISABLED'
  | 'DEPRECATED';

export type SkillScope = 
  | 'PERSONAL'
  | 'TEAM'
  | 'WORKSPACE'
  | 'ORGANIZATIONAL';

export type SkillTrustLevel = 
  | 'OFFICIAL'
  | 'VERIFIED'
  | 'ORGANIZATION_APPROVED'
  | 'COMMUNITY'
  | 'UNTRUSTED';

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  default?: any;
  description: string;
}

export interface SkillExecutionContext {
  workspaceState?: any;
  currentUser?: string;
  parameters: Record<string, any>;
}

export interface PlannedStepTemplate {
  capability: string;
  target: Record<string, any>;
  arguments?: Record<string, any>;
  description?: string;
}

export interface SkillDefinition {
  id: string; // e.g. "weekly-report"
  version: string; // e.g. "1.0.0"
  name: string;
  description: string;
  category: SkillCategory;
  lifecycle: SkillLifecycle;
  scope?: SkillScope;
  trustLevel?: SkillTrustLevel;
  requiredCapabilities: string[];
  parameters: SkillParameter[];
  planGenerator?: (context: SkillExecutionContext) => Promise<PlannedStepTemplate[]>;
  execute?: (context?: any) => Promise<any>;
  verificationCriteria?: {
    expectedArtifacts?: string[];
    expectedStateDiffs?: string[];
  };
  author?: string;
  createdAt?: number;
  updatedAt?: number;
}
