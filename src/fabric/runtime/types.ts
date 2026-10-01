/**
 * FloatGPT — Governed Agent Runtime: Types & State Machine
 * 
 * Defines the contract, lifecycle states, steps, and durable persistence
 * schemas for multi-step governed agents.
 */

import { ActionTarget, ActionResult, VerificationResult } from '../protocol';

export type AgentState = 
  | 'CREATED'
  | 'PLANNING'
  | 'AWAITING_APPROVAL'
  | 'EXECUTING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'HALTED';

export interface AgentContract {
  agentId: string;
  name: string;
  description: string;
  allowedCapabilities: string[];
  maxSteps?: number;
  timeoutMs?: number;
  requiresConfirmation?: boolean;
}

export interface ExecutionStep {
  stepIndex: number;
  operationId: string;
  capability: string;
  target: ActionTarget;
  arguments: Record<string, any>;
  description?: string;
  status: 'PENDING' | 'EXECUTING' | 'AWAITING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  preStateHash?: string;
  postStateHash?: string;
  result?: ActionResult;
  verification?: VerificationResult;
  error?: string;
  durationMs?: number;
}

export interface WorkflowPlan {
  planId: string;
  goal: string;
  agentId: string;
  steps: ExecutionStep[];
  currentStepIndex: number;
  status: AgentState;
  maxSteps: number;
  timeoutMs: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
}

export interface WorkflowExecutionRecord {
  planId: string;
  agentId: string;
  goal: string;
  status: AgentState;
  totalSteps: number;
  completedSteps: number;
  startTime: number;
  endTime?: number;
  durationMs: number;
  allStepsVerified: boolean;
  error?: string;
}

export interface AgentExecutionOptions {
  maxSteps?: number;
  timeoutMs?: number;
  autoApproveLowRisk?: boolean;
  cancellationToken?: { isCancelled: boolean };
}
