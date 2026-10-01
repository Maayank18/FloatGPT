/**
 * FloatGPT — Phase 4 Skills, Automation & Durable Workflows Verification Suite
 * 
 * Verifies the complete Phase 4 matrix:
 * 1. Skill Registry registration, version resolution, and category queries
 * 2. Capability dependency validation (rejects unregistered capabilities)
 * 3. First-Party Skill "weekly-report@1.0.0" execution & artifact generation
 * 4. First-Party Skill "document-summarizer@1.0.0" execution & artifact generation
 * 5. First-Party Skill "meeting-prep@1.0.0" execution & brief generation
 * 6. First-Party Skill "task-cleanup@1.0.0" execution
 * 7. Durable Workflow Engine execution & persistence in WorkflowStore
 * 8. Notification Engine lifecycle emissions & subscription
 * 9. Persistent Scheduler nextRun calculation, quiet hours, and tick() execution
 * 10. Trigger Engine state change detection & throttling
 * 11. Automation Analytics aggregation (completion rate, time saved)
 */

import { SkillRegistry } from '../skills/registry';
import { initializeSkills } from '../skills';
import { weeklyReportSkill } from '../skills/firstParty/weeklyReportSkill';
import { documentSummarizerSkill } from '../skills/firstParty/documentSummarizerSkill';
import { meetingPrepSkill } from '../skills/firstParty/meetingPrepSkill';
import { taskCleanupSkill } from '../skills/firstParty/taskCleanupSkill';
import { WorkflowEngine } from '../automation/workflowEngine';
import { SchedulerService } from '../automation/scheduler';
import { TriggerEngine } from '../automation/triggerEngine';
import { NotificationEngine } from '../automation/notificationEngine';
import { AutomationAnalytics } from '../automation/analytics';
import { WorkflowStore } from '../fabric/runtime/workflowStore';
import { PermissionManager } from '../fabric/permissionManager';
import { SkillDefinition } from '../skills/types';

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

async function runPhase4TestSuite() {
  console.log('================================================================');
  console.log('🧪 FloatGPT — Phase 4 Skills & Automation Verification Suite');
  console.log('================================================================\n');

  // Pre-grant session permission for filesystem.write so skills can write artifacts
  PermissionManager.grant('filesystem.write', 'ALLOW_FOR_SESSION');

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Skill Registry & Version Resolution
  // ─────────────────────────────────────────────────────────────
  console.log('--- TEST 1: Skill Registry & Version Resolution ---');
  SkillRegistry.clear();
  initializeSkills();

  const allSkills = SkillRegistry.getAll();
  assert(allSkills.length === 4, `4 first-party skills registered (got ${allSkills.length})`);

  const reportSkill = SkillRegistry.get('weekly-report');
  assert(reportSkill !== null, 'Resolves weekly-report skill by ID');
  assert(reportSkill?.version === '1.0.0', 'Resolved version is 1.0.0');

  const reportExact = SkillRegistry.get('weekly-report', '1.0.0');
  assert(reportExact !== null, 'Resolves weekly-report@1.0.0 exact version');

  const reportingSkills = SkillRegistry.getByCategory('REPORTING');
  assert(reportingSkills.length >= 1, 'Filters skills by category REPORTING');

  const docSkills = SkillRegistry.getByCategory('DOCUMENTATION');
  assert(docSkills.length >= 1, 'Filters skills by category DOCUMENTATION');

  // Lifecycle status update
  SkillRegistry.updateLifecycle('weekly-report', '1.0.0', 'DISABLED');
  assert(SkillRegistry.get('weekly-report', '1.0.0')?.lifecycle === 'DISABLED', 'Lifecycle updated to DISABLED');
  SkillRegistry.updateLifecycle('weekly-report', '1.0.0', 'ACTIVE');
  assert(SkillRegistry.get('weekly-report', '1.0.0')?.lifecycle === 'ACTIVE', 'Lifecycle restored to ACTIVE');

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Capability Dependency Validation
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Capability Dependency Validation ---');
  const invalidSkill: SkillDefinition = {
    id: 'unreal-renderer',
    version: '1.0.0',
    name: 'Unreal 3D Renderer',
    description: 'Requires non-existent graphics capability',
    category: 'INTEGRATION',
    lifecycle: 'ACTIVE',
    scope: 'WORKSPACE',
    trustLevel: 'COMMUNITY',
    requiredCapabilities: ['graphics.unreal.render_3d'], // NOT in CapabilityRegistry
    parameters: [],
    planGenerator: async () => []
  };

  const regResult = SkillRegistry.register(invalidSkill);
  assert(regResult === false, 'Rejects registration of skill with unregistered capabilities');
  assert(SkillRegistry.has('unreal-renderer') === false, 'Invalid skill not added to catalog');

  // ─────────────────────────────────────────────────────────────
  // TEST 3: First-Party Skill Execution — weekly-report@1.0.0
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: First-Party Skill Execution (weekly-report@1.0.0) ---');
  await WorkflowStore.clear();

  const reportExec = await WorkflowEngine.executeSkill('weekly-report', {
    includeBlockers: true,
    outputPath: 'reports/Weekly_Status.md'
  });

  assert(reportExec.status === 'COMPLETED', 'weekly-report workflow completes with status COMPLETED');
  assert(reportExec.completedSteps === 2, 'Executed all 2 planned steps (read + write)');
  assert(reportExec.allStepsVerified === true, 'All report generation steps passed verification');

  const persistedReport = await WorkflowStore.getPlan(reportExec.planId);
  assert(persistedReport?.status === 'COMPLETED', 'Weekly report plan persisted in WorkflowStore');

  // ─────────────────────────────────────────────────────────────
  // TEST 4: First-Party Skill Execution — document-summarizer@1.0.0
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: First-Party Skill Execution (document-summarizer@1.0.0) ---');
  const summaryExec = await WorkflowEngine.executeSkill('document-summarizer', {
    sourcePath: 'docs/architecture.md',
    format: 'markdown'
  });

  assert(summaryExec.status === 'COMPLETED', 'document-summarizer completes successfully');
  assert(summaryExec.completedSteps === 2, 'Executed read source and write summary steps');
  assert(summaryExec.allStepsVerified === true, 'Summary artifact verified');

  // ─────────────────────────────────────────────────────────────
  // TEST 5: First-Party Skill Execution — meeting-prep@1.0.0
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: First-Party Skill Execution (meeting-prep@1.0.0) ---');
  const meetingExec = await WorkflowEngine.executeSkill('meeting-prep', {
    meetingTitle: 'Executive Staff Meeting',
    outputPath: 'briefings/Exec_Staff.md'
  });

  assert(meetingExec.status === 'COMPLETED', 'meeting-prep briefing completes with COMPLETED');
  assert(meetingExec.completedSteps === 1, 'Executed briefing compilation step');

  // ─────────────────────────────────────────────────────────────
  // TEST 6: First-Party Skill Execution — task-cleanup@1.0.0
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 6: First-Party Skill Execution (task-cleanup@1.0.0) ---');
  const cleanupExec = await WorkflowEngine.executeSkill('task-cleanup', {
    includeArchived: false
  });

  assert(cleanupExec.status === 'COMPLETED', 'task-cleanup completes with COMPLETED');
  assert(cleanupExec.completedSteps === 2, 'Executed task audit steps');

  // ─────────────────────────────────────────────────────────────
  // TEST 7: Notification Engine Streaming & Alerts
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 7: Notification Engine Lifecycle Notifications ---');
  NotificationEngine.clear();

  let liveNotifReceived: boolean = false;
  const unsubscribe = NotificationEngine.subscribe((n) => {
    if (n.type === 'STARTED' || n.type === 'COMPLETED') {
      liveNotifReceived = true;
    }
  });

  await WorkflowEngine.executeSkill('weekly-report');

  assert(Boolean(liveNotifReceived), 'Live notification stream delivered execution event');
  const recentNotifs = NotificationEngine.getRecent(10);
  assert(recentNotifs.length >= 2, `Recorded lifecycle notifications in history (got ${recentNotifs.length})`);
  assert(recentNotifs[0].type === 'COMPLETED', 'Most recent notification is COMPLETED');
  unsubscribe();

  // ─────────────────────────────────────────────────────────────
  // TEST 8: Persistent Scheduler Service
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 8: Persistent Scheduler Service ---');
  SchedulerService.clear();

  const auto1 = SchedulerService.schedule({
    name: 'Weekly Friday Report',
    skillId: 'weekly-report',
    triggerType: 'TIME',
    timeConfig: {
      intervalMinutes: 60,
      quietHoursStart: 22,
      quietHoursEnd: 7
    },
    parameters: {},
    enabled: true
  });

  assert(auto1.enabled === true, 'Scheduled automation created in enabled state');
  assert(auto1.nextRunAt !== undefined, 'Calculated nextRunAt timestamp');

  // Quiet hours calculation
  assert(SchedulerService.isQuietHour(auto1.timeConfig, 23) === true, '23:00 is recognized as quiet hours');
  assert(SchedulerService.isQuietHour(auto1.timeConfig, 3) === true, '03:00 is recognized as quiet hours');
  assert(SchedulerService.isQuietHour(auto1.timeConfig, 14) === false, '14:00 is not quiet hours');

  // Next run calculation throttle check
  const nextRun = SchedulerService.calculateNextRun({ intervalMinutes: 120 }, 100000);
  assert(nextRun === 100000 + 120 * 60 * 1000, 'Next run computed precisely with interval offset');

  // Enable and disable controls
  SchedulerService.disable(auto1.id);
  assert(SchedulerService.get(auto1.id)?.enabled === false, 'Automation successfully disabled');
  SchedulerService.enable(auto1.id);
  assert(SchedulerService.get(auto1.id)?.enabled === true, 'Automation successfully re-enabled');

  // Dispatch tick for due automations (daytime hour: 14)
  auto1.nextRunAt = Date.now() - 1000; // Force due
  const executedIds = await SchedulerService.tick(Date.now(), { currentHour: 14 });
  assert(executedIds.includes(auto1.id), 'tick() identifies and executes due automation');
  assert(auto1.runCount === 1, 'runCount incremented on scheduled execution');

  // ─────────────────────────────────────────────────────────────
  // TEST 9: Trigger Engine State-Change Detection
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 9: Trigger Engine State-Change Detection ---');
  SchedulerService.clear();
  TriggerEngine.clear();

  const stateAuto = SchedulerService.schedule({
    name: 'Post-Task Review',
    skillId: 'document-summarizer',
    triggerType: 'STATE_CHANGE',
    stateConfig: {
      entity: 'task',
      field: 'status',
      expectedValue: 'Completed'
    },
    parameters: { sourcePath: 'README.md' },
    enabled: true
  });

  // State change event matching trigger
  const triggered = await TriggerEngine.onStateChange('task', {
    id: 'task_1',
    status: 'Completed',
    title: 'Deploy microservice'
  });

  assert(triggered.includes(stateAuto.id), 'State change event triggers configured automation');
  assert(stateAuto.runCount === 1, 'Automation runCount incremented on state trigger');

  // Non-matching state change event
  const notTriggered = await TriggerEngine.onStateChange('task', {
    id: 'task_2',
    status: 'In Progress',
    title: 'WIP task'
  });

  assert(notTriggered.length === 0, 'Non-matching state change does not trigger automation');

  // ─────────────────────────────────────────────────────────────
  // TEST 10: Automation Analytics & Value Calculation
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 10: Automation Analytics & Value Calculation ---');
  const metrics = AutomationAnalytics.getMetrics();

  assert(metrics.totalWorkflowsRun >= 4, `Total workflows run tracked (got ${metrics.totalWorkflowsRun})`);
  assert(metrics.completedWorkflows >= 4, `Completed workflows tracked (got ${metrics.completedWorkflows})`);
  assert(metrics.completionRatePercent === 100, 'Completion rate calculated at 100%');
  assert(metrics.verifiedSuccessRatePercent === 100, 'Verified success rate calculated at 100%');
  assert(metrics.estimatedTimeSavedMinutes >= 40, `Estimated human time saved computed (got ${metrics.estimatedTimeSavedMinutes} mins)`);

  // ─────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`Phase 4 Test Results: ${passed} passed, ${failed} failed.`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4TestSuite().catch(err => {
  console.error('Fatal error during Phase 4 test execution:', err);
  process.exit(1);
});
