/**
 * FloatGPT — Cross-App Execution Fabric: Protocol & Type System
 * 
 * Strict, structured action definitions ensuring no raw, unvalidated commands
 * bypass the security and policy boundaries.
 */

export type RiskLevel = 
  | 'LEVEL_0_OBSERVE'    // Read-only / observation (zero risk)
  | 'LEVEL_1_LOW_RISK'   // Safe operations (open known app, navigate URL, change volume)
  | 'LEVEL_2_SENSITIVE'  // Modifies user files, settings, or sends data externally (requires confirmation)
  | 'LEVEL_3_DESTRUCTIVE'// Deletes files, terminates processes, overwrites configurations (strong confirmation)
  | 'LEVEL_4_FORBIDDEN';  // Security violation / system damage (hard-blocked, non-overrideable)

export type ActionStatus = 
  | 'PLANNED'
  | 'AUTHORIZED'
  | 'EXECUTING'
  | 'OBSERVING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'BLOCKED'
  | 'RECOVERING'
  | 'ABORTED_BY_USER';

export type CapabilityDomain =
  | 'application'
  | 'browser'
  | 'filesystem'
  | 'window'
  | 'clipboard'
  | 'system'
  | 'process'
  | 'workspace'
  | 'document'
  | 'share'
  | 'messaging';

export interface ActionTarget {
  application?: string;
  url?: string;
  path?: string;
  windowTitle?: string;
  selector?: string;
  domain?: string;
  processName?: string;
  content?: string;
}

export interface StructuredAction {
  actionId: string;
  capability: string; // e.g. "application.open", "browser.navigate", "filesystem.read"
  domain: CapabilityDomain;
  target: ActionTarget;
  arguments: Record<string, any>;
  source: 'user_explicit' | 'agent_planner' | 'workflow' | 'untrusted_external';
  risk: RiskLevel;
  requiresConfirmation: boolean;
  reversible: boolean;
  platform?: 'windows' | 'macos' | 'linux' | 'universal';
  timeoutMs?: number;
  idempotencyKey?: string;
  description: string;
}

export interface StateChangeSnapshot {
  before?: Record<string, any>;
  after?: Record<string, any>;
  diff?: string;
}

export interface ActionResult {
  actionId: string;
  capability: string;
  success: boolean;
  status: ActionStatus;
  output?: string;
  data?: any;
  error?: string;
  executionTimeMs: number;
  stateChanges?: StateChangeSnapshot;
  verified?: boolean;
  verificationDetails?: string;
}

export interface VerificationResult {
  actionId: string;
  verified: boolean;
  status?: 'VERIFIED' | 'FAILED' | 'UNKNOWN';
  expectedState: string;
  observedState: string;
  confidence: number; // 0.0 to 1.0
  evidence?: Record<string, any>;
  notes?: string;
}

export interface Capability {
  id: string;
  domain: CapabilityDomain;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  reversible: boolean;
  supportsVerification: boolean;
  supportedPlatforms: Array<'windows' | 'macos' | 'linux' | 'universal'>;
}

export interface PermissionScope {
  id: string;
  capability: string;
  target?: string;
  scopeType: 'ALWAYS_ALLOW' | 'ALLOW_FOR_SESSION' | 'ALLOW_FOR_WORKFLOW' | 'ASK_EVERY_TIME' | 'DENY';
  grantedAt: number;
  expiresAt?: number;
}
