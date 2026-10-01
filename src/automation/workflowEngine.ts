/**
 * FloatGPT — Durable Workflow Engine
 * 
 * Orchestrates multi-step durable workflows instantiated from Skills.
 * Enforces step-level idempotency, persistence in WorkflowStore (idb-keyval),
 * human approval cards, and analytics recording.
 */

import { SkillRegistry } from '../skills/registry';
import { AgentRuntime } from '../fabric/runtime/agentRuntime';
import { AgentContract, WorkflowExecutionRecord, AgentExecutionOptions } from '../fabric/runtime/types';
import { AutomationAnalytics } from './analytics';
import { NotificationEngine } from './notificationEngine';

export class WorkflowEngine {
  /**
   * Executes a registered skill as a durable multi-step workflow.
   */
  static async executeSkill(
    skillId: string,
    parameters: Record<string, any> = {},
    options?: {
      version?: string;
      workspaceState?: any;
      executionOptions?: AgentExecutionOptions;
    }
  ): Promise<WorkflowExecutionRecord> {
    const skill = SkillRegistry.get(skillId, options?.version);
    if (!skill) {
      throw new Error(`Skill "${skillId}"${options?.version ? `@${options.version}` : ''} not found or inactive.`);
    }

    // 1. Synthesize AgentContract from Skill definition
    const contract: AgentContract = {
      agentId: `skill.${skill.id}`,
      name: skill.name,
      description: skill.description,
      allowedCapabilities: skill.requiredCapabilities,
      maxSteps: 15,
      timeoutMs: 120000,
      requiresConfirmation: false
    };

    // 2. Generate concrete execution plan steps from Skill definition
    const stepTemplates = skill.planGenerator
      ? await skill.planGenerator({
          parameters,
          workspaceState: options?.workspaceState
        })
      : [];

    // 3. Create persistent workflow plan
    const plan = await AgentRuntime.createPlan(
      `Execute ${skill.name}`,
      contract,
      stepTemplates,
      options?.executionOptions
    );

    NotificationEngine.emit({
      automationId: skill.id,
      type: 'STARTED',
      title: `Workflow Started: ${skill.name}`,
      message: `Executing ${stepTemplates.length} steps for "${skill.name}".`,
      planId: plan.planId
    });

    // 4. Dispatch through AgentRuntime
    const execOptions = { autoApproveLowRisk: true, ...options?.executionOptions };
    const record = await AgentRuntime.executePlan(plan.planId, contract, execOptions);

    // 5. Emit completion or approval notification
    if (record.status === 'AWAITING_APPROVAL') {
      NotificationEngine.emit({
        automationId: skill.id,
        type: 'WAITING_FOR_PERMISSION',
        title: `Approval Required: ${skill.name}`,
        message: 'A sensitive step requires your confirmation to continue.',
        planId: plan.planId
      });
    } else if (record.status === 'COMPLETED') {
      NotificationEngine.emit({
        automationId: skill.id,
        type: 'COMPLETED',
        title: `Workflow Completed: ${skill.name}`,
        message: `Successfully executed and verified all ${record.completedSteps} steps in ${(record.durationMs / 1000).toFixed(1)}s.`,
        planId: plan.planId
      });

      // Record analytics
      AutomationAnalytics.recordExecution(record);
    } else {
      NotificationEngine.emit({
        automationId: skill.id,
        type: 'FAILED',
        title: `Workflow Failed: ${skill.name}`,
        message: record.error || 'Execution encountered an unrecoverable error.',
        planId: plan.planId
      });
    }

    return record;
  }

  /**
   * Resumes an execution awaiting human approval.
   */
  static async approveAndResume(
    planId: string,
    skillId: string,
    version?: string
  ): Promise<WorkflowExecutionRecord> {
    const skill = SkillRegistry.get(skillId, version);
    if (!skill) throw new Error(`Skill "${skillId}" not found.`);

    const contract: AgentContract = {
      agentId: `skill.${skill.id}`,
      name: skill.name,
      description: skill.description,
      allowedCapabilities: skill.requiredCapabilities,
      maxSteps: 15,
      timeoutMs: 120000,
      requiresConfirmation: false
    };

    const record = await AgentRuntime.approveAndResume(planId, contract);
    if (record.status === 'COMPLETED') {
      AutomationAnalytics.recordExecution(record);
    }
    return record;
  }
}
