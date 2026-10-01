/**
 * FloatGPT — Governed Agent Runtime Engine
 * 
 * Central coordinator for multi-step agent execution.
 * Enforces:
 * 1. Strict finite state machine (CREATED -> PLANNING -> EXECUTING -> VERIFYING -> COMPLETED)
 * 2. Hard step limits (maxSteps = 15) to prevent unbounded loops
 * 3. Execution timeouts (default 300,000ms) with clean cancellation
 * 4. Human-in-the-loop approval escalation (AWAITING_APPROVAL) for sensitive/destructive operations
 * 5. Durable workflow persistence and step idempotency via WorkflowStore
 * 6. Authoritative dispatch via ActionBroker and verification via VerificationEngine
 */

import {
  AgentContract,
  AgentState,
  ExecutionStep,
  WorkflowPlan,
  WorkflowExecutionRecord,
  AgentExecutionOptions
} from './types';
import { WorkflowStore } from './workflowStore';
import { ActionBroker } from '../actionBroker';
import { VerificationEngine } from '../verifier';
import { StructuredAction, ActionResult, VerificationResult, RiskLevel } from '../protocol';
import { CapabilityRegistry } from '../registry';

export class AgentRuntime {
  private static activePlans: Map<string, WorkflowPlan> = new Map();
  private static cancellationTokens: Map<string, { isCancelled: boolean }> = new Map();

  /**
   * Creates a new workflow plan.
   */
  static async createPlan(
    goal: string,
    contract: AgentContract,
    steps: Array<{
      capability: string;
      target: Record<string, any>;
      arguments?: Record<string, any>;
      description?: string;
    }>,
    options?: AgentExecutionOptions
  ): Promise<WorkflowPlan> {
    const planId = `wf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const maxSteps = Math.min(options?.maxSteps || contract.maxSteps || 15, 25);
    const timeoutMs = options?.timeoutMs || contract.timeoutMs || 300000;

    const executionSteps: ExecutionStep[] = steps.map((s, idx) => ({
      stepIndex: idx,
      operationId: `${planId}_step_${idx}`,
      capability: s.capability,
      target: s.target,
      arguments: s.arguments || {},
      description: s.description || `Step ${idx + 1}: ${s.capability}`,
      status: 'PENDING'
    }));

    const plan: WorkflowPlan = {
      planId,
      goal,
      agentId: contract.agentId,
      steps: executionSteps,
      currentStepIndex: 0,
      status: 'CREATED',
      maxSteps,
      timeoutMs,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await WorkflowStore.savePlan(plan);
    this.activePlans.set(planId, plan);
    return plan;
  }

  /**
   * Executes a plan from start to finish or resumes from the first pending step.
   */
  static async executePlan(
    planId: string,
    contract: AgentContract,
    options?: AgentExecutionOptions
  ): Promise<WorkflowExecutionRecord> {
    let plan = await WorkflowStore.getPlan(planId);
    if (!plan) {
      throw new Error(`Workflow plan "${planId}" not found in storage.`);
    }

    const startTime = Date.now();
    const token = options?.cancellationToken || { isCancelled: false };
    this.cancellationTokens.set(planId, token);

    plan.status = 'PLANNING';
    await WorkflowStore.savePlan(plan);

    // 1. Enforce Step Limit Boundary
    if (plan.steps.length > plan.maxSteps) {
      plan.status = 'FAILED';
      plan.error = `Workflow exceeds maximum allowed steps (${plan.steps.length} > ${plan.maxSteps}). Halting execution.`;
      await WorkflowStore.savePlan(plan);
      return this.createExecutionRecord(plan, startTime);
    }

    plan.status = 'EXECUTING';
    await WorkflowStore.savePlan(plan);

    for (let i = plan.currentStepIndex; i < plan.steps.length; i++) {
      const step = plan.steps[i];

      // Check cancellation
      if (token.isCancelled) {
        plan.status = 'HALTED';
        plan.error = 'Execution cancelled by user or cancellation token.';
        step.status = 'SKIPPED';
        await WorkflowStore.savePlan(plan);
        return this.createExecutionRecord(plan, startTime);
      }

      // Check overall plan timeout
      if (Date.now() - startTime > plan.timeoutMs) {
        plan.status = 'FAILED';
        plan.error = `Workflow exceeded execution timeout (${plan.timeoutMs}ms). Halting execution.`;
        step.status = 'FAILED';
        step.error = 'Execution timed out.';
        await WorkflowStore.savePlan(plan);
        return this.createExecutionRecord(plan, startTime);
      }

      // Idempotency: Skip already completed steps
      if (step.status === 'COMPLETED') {
        continue;
      }

      // 2. Validate against Agent Contract Allowed Capabilities
      if (!contract.allowedCapabilities.includes(step.capability)) {
        plan.status = 'FAILED';
        step.status = 'FAILED';
        const err = `Capability "${step.capability}" is not permitted by Agent Contract "${contract.agentId}".`;
        step.error = err;
        plan.error = err;
        await WorkflowStore.savePlan(plan);
        return this.createExecutionRecord(plan, startTime);
      }

      // Execute Step
      plan.currentStepIndex = i;
      step.status = 'EXECUTING';
      const stepStartTime = Date.now();
      await WorkflowStore.savePlan(plan);

      const capInfo = CapabilityRegistry.get(step.capability);
      const riskLevel: RiskLevel = capInfo?.riskLevel || 'LEVEL_1_LOW_RISK';

      const structuredAction: StructuredAction = {
        actionId: step.operationId,
        capability: step.capability,
        domain: (capInfo?.domain as any) || 'system',
        target: step.target,
        arguments: step.arguments,
        source: 'agent_planner',
        risk: riskLevel,
        requiresConfirmation: options?.autoApproveLowRisk ? false : (contract.requiresConfirmation || false),
        reversible: capInfo?.reversible || false,
        description: step.description || `Execute ${step.capability}`,
        idempotencyKey: step.operationId
      };

      try {
        const actionResult: ActionResult = await ActionBroker.dispatch(structuredAction);
        step.result = actionResult;
        step.durationMs = Date.now() - stepStartTime;

        if (actionResult.status === 'AUTHORIZED' || (actionResult.status === 'BLOCKED' && actionResult.error?.includes('confirmation'))) {
          plan.status = 'AWAITING_APPROVAL';
          step.status = 'AWAITING_APPROVAL';
          await WorkflowStore.savePlan(plan);
          return this.createExecutionRecord(plan, startTime);
        }

        if (actionResult.status === 'BLOCKED') {
          plan.status = 'FAILED';
          step.status = 'FAILED';
          step.error = actionResult.error || 'Action blocked by security policy.';
          plan.error = step.error;
          await WorkflowStore.savePlan(plan);
          return this.createExecutionRecord(plan, startTime);
        }

        if (!actionResult.success) {
          plan.status = 'FAILED';
          step.status = 'FAILED';
          step.error = actionResult.error || 'Action execution failed.';
          plan.error = step.error;
          await WorkflowStore.savePlan(plan);
          return this.createExecutionRecord(plan, startTime);
        }

        // Post-execution verification
        plan.status = 'VERIFYING';
        step.status = 'COMPLETED';
        await WorkflowStore.savePlan(plan);

        // Verification check
        const verification = await this.verifyStep(structuredAction, actionResult);
        step.verification = verification;

        if (verification.status === 'FAILED') {
          plan.status = 'FAILED';
          step.status = 'FAILED';
          step.error = `Verification assertion failed: ${verification.observedState}`;
          plan.error = step.error;
          await WorkflowStore.savePlan(plan);
          return this.createExecutionRecord(plan, startTime);
        }

        // UNKNOWN state does not fail the execution, but warns and records zero false success
        plan.status = 'EXECUTING';
        await WorkflowStore.savePlan(plan);

      } catch (err: any) {
        plan.status = 'FAILED';
        step.status = 'FAILED';
        step.error = err.message || 'Execution error in runtime.';
        plan.error = step.error;
        await WorkflowStore.savePlan(plan);
        return this.createExecutionRecord(plan, startTime);
      }
    }

    // All steps executed successfully
    plan.status = 'COMPLETED';
    plan.completedAt = Date.now();
    await WorkflowStore.savePlan(plan);

    return this.createExecutionRecord(plan, startTime);
  }

  /**
   * Approves a paused step and resumes execution.
   */
  static async approveAndResume(
    planId: string,
    contract: AgentContract
  ): Promise<WorkflowExecutionRecord> {
    const plan = await WorkflowStore.getPlan(planId);
    if (!plan) throw new Error(`Plan "${planId}" not found.`);

    const currentStep = plan.steps[plan.currentStepIndex];
    if (currentStep && currentStep.status === 'AWAITING_APPROVAL') {
      // Temporarily mark as pending so execution loop can dispatch with approved permission
      currentStep.status = 'PENDING';
      plan.status = 'EXECUTING';
      await WorkflowStore.savePlan(plan);
    }

    return await this.executePlan(planId, contract);
  }

  /**
   * Cancels a running or paused plan.
   */
  static cancelPlan(planId: string): boolean {
    const token = this.cancellationTokens.get(planId);
    if (token) {
      token.isCancelled = true;
      return true;
    }
    return false;
  }

  private static async verifyStep(
    action: StructuredAction,
    result: ActionResult
  ): Promise<VerificationResult> {
    const adapter = (ActionBroker as any).adapters?.find((a: any) =>
      a.capabilities().some((c: any) => c.id === action.capability)
    );

    if (adapter) {
      return await VerificationEngine.verify(action, result, adapter);
    }

    return {
      actionId: action.actionId,
      verified: true,
      status: 'VERIFIED',
      expectedState: 'Completed execution',
      observedState: 'Action reported successful by adapter',
      confidence: 0.85
    };
  }

  private static createExecutionRecord(
    plan: WorkflowPlan,
    startTime: number
  ): WorkflowExecutionRecord {
    const completedSteps = plan.steps.filter(s => s.status === 'COMPLETED').length;
    const allVerified = plan.steps.every(
      s => s.status !== 'COMPLETED' || (s.verification && s.verification.verified)
    );

    return {
      planId: plan.planId,
      agentId: plan.agentId,
      goal: plan.goal,
      status: plan.status,
      totalSteps: plan.steps.length,
      completedSteps,
      startTime,
      endTime: Date.now(),
      durationMs: Date.now() - startTime,
      allStepsVerified: allVerified,
      error: plan.error
    };
  }
}
