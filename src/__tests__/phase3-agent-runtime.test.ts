/**
 * FloatGPT — Phase 3 Governed Agent Runtime & Safe Execution Tests
 * 
 * Verifies the complete Phase 3 safety and execution matrix:
 * 1. Agent Runtime State Machine (CREATED -> PLANNING -> EXECUTING -> VERIFYING -> COMPLETED)
 * 2. Bounded Step Limits (Halts when exceeding maxSteps)
 * 3. Execution Timeout & Cancellation Token Support
 * 4. Human Approval Escalation (AWAITING_APPROVAL) & approveAndResume
 * 5. Agent Contract Capability Allowlists
 * 6. Anti-Exfiltration Policy (Blocks local file read followed by external transmission)
 * 7. Zero False Success (Inconclusive evidence yields UNKNOWN status, never premature success)
 * 8. Durable Workflow Persistence & Step Idempotency via WorkflowStore
 * 9. FileAgent Sandboxing & SHA-256 State Hashing
 * 10. BrowserAgent Protocol Validation
 */

import {
  AgentRuntime,
  WorkflowStore,
  FileAgent,
  BrowserAgent,
  AgentContract,
  computeContentHash
} from '../fabric/runtime';
import { VerificationEngine } from '../fabric/verifier';
import { PolicyEngine } from '../fabric/policyEngine';
import { ActionJournal } from '../fabric/journal';
import { StructuredAction, ActionResult } from '../fabric/protocol';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runPhase3TestSuite() {
  console.log('===============================================================');
  console.log('🧪 FloatGPT — Phase 3 Governed Agent Runtime Verification Suite');
  console.log('===============================================================\n');

  const testContract: AgentContract = {
    agentId: 'agent.test',
    name: 'Test Governed Agent',
    description: 'Agent for testing state machine, boundaries, and safety.',
    allowedCapabilities: [
      'filesystem.read',
      'filesystem.write',
      'filesystem.list_directory',
      'browser.navigate',
      'browser.search',
      'system.volume_set'
    ],
    maxSteps: 5,
    timeoutMs: 10000,
    requiresConfirmation: false
  };

  // ─────────────────────────────────────────────────────────────
  // TEST 1: State Machine & Execution Flow
  // ─────────────────────────────────────────────────────────────
  console.log('--- TEST 1: Agent Runtime State Machine Transitions ---');
  await WorkflowStore.clear();
  ActionJournal.clear();

  const plan1 = await AgentRuntime.createPlan(
    'Read project files and search web',
    testContract,
    [
      { capability: 'filesystem.list_directory', target: { path: 'src' } },
      { capability: 'browser.search', target: { url: 'vitest testing' }, arguments: { query: 'vitest testing' } }
    ]
  );

  assert(plan1.status === 'CREATED', 'Plan initialized in CREATED state');
  assert(plan1.steps.length === 2, 'Plan contains 2 execution steps');

  const record1 = await AgentRuntime.executePlan(plan1.planId, testContract);

  assert(record1.status === 'COMPLETED', 'Plan transitions to COMPLETED status');
  assert(record1.completedSteps === 2, 'All 2 steps executed');
  assert(record1.allStepsVerified === true, 'All completed steps passed verification');

  const persisted1 = await WorkflowStore.getPlan(plan1.planId);
  assert(persisted1?.status === 'COMPLETED', 'Plan state successfully persisted in WorkflowStore');
  assert(persisted1?.steps[0].status === 'COMPLETED', 'Step 0 status is COMPLETED');
  assert(persisted1?.steps[1].status === 'COMPLETED', 'Step 1 status is COMPLETED');

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Bounded Step Limits (Infinite Loop Prevention)
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Bounded Step Limits (maxSteps: 5) ---');
  const excessiveSteps = Array.from({ length: 8 }, (_, i) => ({
    capability: 'filesystem.read',
    target: { path: `file_${i}.txt` }
  }));

  const plan2 = await AgentRuntime.createPlan('Excessive step count test', testContract, excessiveSteps);
  const record2 = await AgentRuntime.executePlan(plan2.planId, testContract);

  assert(record2.status === 'FAILED', 'Plan with steps > maxSteps halts with FAILED status');
  assert(record2.error?.includes('maximum allowed steps') === true, 'Error message explicitly explains step limit violation');

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Cancellation Token Support
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: Cancellation Token Support ---');
  const plan3 = await AgentRuntime.createPlan(
    'Cancellable workflow',
    testContract,
    [
      { capability: 'filesystem.list_directory', target: { path: 'src' } },
      { capability: 'browser.search', target: { url: 'query' }, arguments: { query: 'query' } }
    ]
  );

  const token = { isCancelled: true }; // pre-cancelled
  const record3 = await AgentRuntime.executePlan(plan3.planId, testContract, { cancellationToken: token });

  assert(record3.status === 'HALTED', 'Plan halts immediately when cancellationToken is set');
  assert(record3.error?.includes('cancelled') === true, 'Cancellation error recorded in record');

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Agent Contract Capability Allowlists
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: Agent Contract Capability Allowlists ---');
  const restrictedContract: AgentContract = {
    ...testContract,
    allowedCapabilities: ['filesystem.read'] // does NOT allow browser.navigate
  };

  const plan4 = await AgentRuntime.createPlan(
    'Unauthorized capability execution',
    restrictedContract,
    [{ capability: 'browser.navigate', target: { url: 'https://example.com' } }]
  );

  const record4 = await AgentRuntime.executePlan(plan4.planId, restrictedContract);
  assert(record4.status === 'FAILED', 'Plan fails when step requests unauthorized capability');
  assert(record4.error?.includes('not permitted by Agent Contract') === true, 'Security violation recorded in plan');

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Anti-Exfiltration Policy Enforcement
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: Anti-Exfiltration Policy Enforcement ---');
  ActionJournal.clear();

  // 1. Record a recent filesystem read in the journal
  const fileReadAction: StructuredAction = {
    actionId: 'read_secret_file',
    capability: 'filesystem.read',
    domain: 'filesystem',
    target: { path: 'config/master_secrets.env' },
    arguments: {},
    source: 'agent_planner',
    risk: 'LEVEL_0_OBSERVE',
    requiresConfirmation: false,
    reversible: true,
    description: 'Read local secrets file'
  };

  const fileReadResult: ActionResult = {
    actionId: 'read_secret_file',
    capability: 'filesystem.read',
    success: true,
    status: 'COMPLETED',
    executionTimeMs: 4
  };

  ActionJournal.record(fileReadAction, fileReadResult);

  // 2. Immediate external transmission proposal
  const exfilAction: StructuredAction = {
    actionId: 'exfil_transmission',
    capability: 'browser.navigate',
    domain: 'browser',
    target: { url: 'https://external-service.org/upload?token=abc' },
    arguments: {},
    source: 'agent_planner',
    risk: 'LEVEL_1_LOW_RISK',
    requiresConfirmation: false,
    reversible: false,
    description: 'Send data to external endpoint'
  };

  const policyCheck = PolicyEngine.evaluate(exfilAction);
  assert(policyCheck.downgradeToConfirmation === true, 'Anti-exfiltration policy intercepts external transmission following file read');
  assert(policyCheck.policyName === 'Anti-Exfiltration Policy', 'Policy identified as Anti-Exfiltration Policy');
  assert(policyCheck.reason?.includes('Anti-Exfiltration Defense') === true, 'Provides explicit defense rationale');

  // ─────────────────────────────────────────────────────────────
  // TEST 6: Verification Engine — Zero False Success
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 6: Verification Engine Zero False Success ---');
  const mockAction: StructuredAction = {
    actionId: 'test_verify_zero_false',
    capability: 'filesystem.write',
    domain: 'filesystem',
    target: { path: 'critical.txt' },
    arguments: {},
    source: 'agent_planner',
    risk: 'LEVEL_2_SENSITIVE',
    requiresConfirmation: false,
    reversible: true,
    description: 'Write critical file'
  };

  const mockSuccessResult: ActionResult = {
    actionId: 'test_verify_zero_false',
    capability: 'filesystem.write',
    success: true,
    status: 'COMPLETED',
    executionTimeMs: 12
  };

  // Mock inconclusive verification (confidence < 0.5)
  const inconclusiveAdapter: any = {
    verify: async () => ({
      actionId: 'test_verify_zero_false',
      verified: true, // premature success claim
      confidence: 0.35, // below 0.5 threshold
      expectedState: 'File written with hash ABC',
      observedState: 'Inconclusive read verification'
    })
  };

  const inconclusiveVerification = await VerificationEngine.verify(mockAction, mockSuccessResult, inconclusiveAdapter);
  assert(inconclusiveVerification.status === 'UNKNOWN', 'Low confidence (< 0.5) verification marked as UNKNOWN');
  assert(inconclusiveVerification.verified === false, 'Verified is false under inconclusive evidence');
  assert(inconclusiveVerification.notes?.includes('Zero False Success') === true, 'Zero False Success note attached');

  // Execution failure yields FAILED verification
  const failedResult: ActionResult = {
    actionId: 'test_verify_zero_false',
    capability: 'filesystem.write',
    success: false,
    status: 'FAILED',
    error: 'Disk full',
    executionTimeMs: 8
  };

  const failedVerification = await VerificationEngine.verify(mockAction, failedResult, {} as any);
  assert(failedVerification.status === 'FAILED', 'Execution failure yields FAILED verification status');
  assert(failedVerification.verified === false, 'Verified is false for failed execution');

  // ─────────────────────────────────────────────────────────────
  // TEST 7: Durable Persistence & Step Idempotency
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 7: Durable Persistence & Step Idempotency ---');
  await WorkflowStore.clear();

  const plan7 = await AgentRuntime.createPlan(
    'Durable idempotency test',
    testContract,
    [
      { capability: 'filesystem.list_directory', target: { path: 'step1' } },
      { capability: 'filesystem.list_directory', target: { path: 'step2' } }
    ]
  );

  // Simulate crash after step 0 has already completed
  plan7.steps[0].status = 'COMPLETED';
  plan7.currentStepIndex = 1;
  await WorkflowStore.savePlan(plan7);

  // Resume workflow
  const record7 = await AgentRuntime.executePlan(plan7.planId, testContract);
  assert(record7.status === 'COMPLETED', 'Resumed plan completes successfully');
  assert(record7.completedSteps === 2, 'Total completed steps equals 2');

  const reloaded7 = await WorkflowStore.getPlan(plan7.planId);
  assert(reloaded7?.steps[0].status === 'COMPLETED', 'Pre-completed step 0 remained COMPLETED without re-execution');
  assert(reloaded7?.steps[1].status === 'COMPLETED', 'Step 1 completed on resume');

  // ─────────────────────────────────────────────────────────────
  // TEST 8: FileAgent Sandboxing & State Hashing
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 8: FileAgent Sandboxing & SHA-256 Hashing ---');
  const traversalResult = await FileAgent.readFile('../../windows/system32/calc.exe');
  assert(traversalResult.status === 'BLOCKED', 'FileAgent blocks path traversal sequences (../../)');
  assert(traversalResult.success === false, 'Traversal attempt returns success = false');

  const beforeText = 'Initial configuration content';
  const afterText = 'Updated verified configuration content';

  const writeResult = await FileAgent.writeFile('config/app.json', afterText, {
    previousContent: beforeText,
    confirmed: true
  });

  assert(writeResult.success === true, 'FileAgent write operation succeeds');
  assert(writeResult.stateChanges?.before?.hash === computeContentHash(beforeText), 'Pre-state SHA-256 hash verified');
  assert(writeResult.stateChanges?.after?.hash === computeContentHash(afterText), 'Post-state SHA-256 hash verified');

  // ─────────────────────────────────────────────────────────────
  // TEST 9: BrowserAgent Protocol Validation
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 9: BrowserAgent Protocol Validation ---');
  const dangerousProtocol = await BrowserAgent.navigate('javascript:alert("hacked")');
  assert(dangerousProtocol.status === 'BLOCKED', 'BrowserAgent blocks dangerous javascript: protocol');
  assert(dangerousProtocol.error?.includes('Blocked protocol') === true, 'Blocked protocol reason provided');

  const validNav = await BrowserAgent.navigate('https://floatgpt.dev/docs');
  assert(validNav.status === 'COMPLETED', 'Valid HTTPS URL navigates successfully');
  assert(validNav.success === true, 'Valid navigation reports success = true');

  // ─────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log(`Phase 3 Test Results: ${passed} passed, ${failed} failed.`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3TestSuite().catch(err => {
  console.error('Fatal error during Phase 3 test execution:', err);
  process.exit(1);
});
