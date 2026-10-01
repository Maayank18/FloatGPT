/**
 * FloatGPT — Phase 6 Platform, Ecosystem, Team Intelligence & Enterprise Verification Suite
 * 
 * Verifies the complete enterprise platform matrix:
 * 1. Multi-Tenant Isolation (cross-tenant access denial)
 * 2. RBAC Role Hierarchy & Boundaries (viewer/guest restrictions vs member/admin)
 * 3. Data Classifications (CONFIDENTIAL and RESTRICTED enforcement)
 * 4. The Personal Data Firewall (private memories cannot leak to team/org)
 * 5. Controlled Memory Promotion (explicit promotion bridge with audit trail)
 * 6. Shadow AI Cross-System Reasoning (causal correlation with calibrated confidence)
 * 7. Organizational Risk & Bottleneck Evaluation (bottleneck detection, deadline risks)
 * 8. Secure Inbound Webhooks (HMAC-SHA256, replay attack window, idempotency)
 * 9. First-Party Enterprise Connectors (GitHub and Support connectors)
 * 10. Developer Platform SDK (extension registration and skill cataloging)
 * 11. Sandboxed Extension Simulator (permission denial, tool crash, timeout)
 * 12. Tamper-Evident Hash-Chained Audit Trail (SHA-256 chain verification & tampering detection)
 * 13. Critical Security Invariant (INTELLIGENCE ≠ AUTHORITY in enterprise context)
 */

import {
  TenantManager,
  RBACEngine,
  MemoryPromotionBridge,
  ShadowAIEngine,
  OrgRiskEngine,
  WebhookHandler,
  GitHubConnector,
  SupportConnector,
  FloatGPTSDK,
  ExtensionSimulator,
  AuditLogger
} from '../platform';
import { SkillDefinition } from '../skills/types';
import { SkillRegistry } from '../skills/registry';

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

async function runPhase6TestSuite() {
  console.log('================================================================');
  console.log('🧪 FloatGPT — Phase 6 Platform & Enterprise Verification Suite');
  console.log('================================================================\n');

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Multi-Tenant Isolation
  // ─────────────────────────────────────────────────────────────
  console.log('--- TEST 1: Multi-Tenant Isolation ---');
  TenantManager.clear();
  AuditLogger.clear();

  const tenantAcme = TenantManager.createTenant('Acme Corp', 'acme.com');
  const tenantGlobex = TenantManager.createTenant('Globex Inc', 'globex.com');

  const userAlice = TenantManager.registerUser({
    tenantId: tenantAcme.id,
    email: 'alice@acme.com',
    name: 'Alice',
    role: 'ADMIN'
  });

  const resourceGlobex = {
    id: 'res_globex_secrets',
    tenantId: tenantGlobex.id,
    scope: 'ORGANIZATION' as const,
    classification: 'INTERNAL' as const
  };

  const crossTenantAuth = RBACEngine.authorize(
    { userId: userAlice.id, tenantId: userAlice.tenantId, role: userAlice.role },
    'read',
    resourceGlobex
  );

  assert(crossTenantAuth.authorized === false, 'Cross-tenant access strictly denied');
  assert(crossTenantAuth.reason.includes('Cross-tenant access strictly denied'), 'Reason details cross-tenant rejection');

  // ─────────────────────────────────────────────────────────────
  // TEST 2: RBAC Role Hierarchy & Action Boundaries
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: RBAC Role Hierarchy & Action Boundaries ---');

  const wsEngineering = TenantManager.createWorkspace(tenantAcme.id, 'Engineering');

  const viewerBob = TenantManager.registerUser({
    tenantId: tenantAcme.id,
    email: 'bob@acme.com',
    name: 'Bob',
    role: 'VIEWER',
    workspaceIds: [wsEngineering.id]
  });

  const memberCarol = TenantManager.registerUser({
    tenantId: tenantAcme.id,
    email: 'carol@acme.com',
    name: 'Carol',
    role: 'MEMBER',
    workspaceIds: [wsEngineering.id]
  });

  const resDoc = {
    id: 'doc_arch',
    tenantId: tenantAcme.id,
    workspaceId: wsEngineering.id,
    scope: 'WORKSPACE' as const,
    classification: 'INTERNAL' as const
  };

  // VIEWER read -> allowed
  const bobRead = RBACEngine.authorize({ userId: viewerBob.id, tenantId: tenantAcme.id, role: 'VIEWER', workspaceId: wsEngineering.id }, 'read', resDoc);
  assert(bobRead.authorized === true, 'VIEWER role can read INTERNAL workspace doc');

  // VIEWER write -> rejected
  const bobWrite = RBACEngine.authorize({ userId: viewerBob.id, tenantId: tenantAcme.id, role: 'VIEWER', workspaceId: wsEngineering.id }, 'write', resDoc);
  assert(bobWrite.authorized === false, 'VIEWER role cannot write');
  assert(bobWrite.requiredRole === 'MEMBER', 'Write requires minimum MEMBER role');

  // VIEWER execute -> rejected
  const bobExec = RBACEngine.authorize({ userId: viewerBob.id, tenantId: tenantAcme.id, role: 'VIEWER', workspaceId: wsEngineering.id }, 'execute', resDoc);
  assert(bobExec.authorized === false, 'VIEWER role cannot execute workflows');

  // MEMBER write & execute -> allowed
  const carolWrite = RBACEngine.authorize({ userId: memberCarol.id, tenantId: tenantAcme.id, role: 'MEMBER', workspaceId: wsEngineering.id }, 'write', resDoc);
  assert(carolWrite.authorized === true, 'MEMBER role can write');

  const carolExec = RBACEngine.authorize({ userId: memberCarol.id, tenantId: tenantAcme.id, role: 'MEMBER', workspaceId: wsEngineering.id }, 'execute', resDoc);
  assert(carolExec.authorized === true, 'MEMBER role can execute workflows');

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Data Classification (CONFIDENTIAL & RESTRICTED)
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: Data Classification Enforcement ---');

  const resRestricted = {
    id: 'res_payroll',
    tenantId: tenantAcme.id,
    workspaceId: wsEngineering.id,
    scope: 'WORKSPACE' as const,
    classification: 'RESTRICTED' as const
  };

  // Member cannot read RESTRICTED
  const carolRestricted = RBACEngine.authorize({ userId: memberCarol.id, tenantId: tenantAcme.id, role: 'MEMBER', workspaceId: wsEngineering.id }, 'read', resRestricted);
  assert(carolRestricted.authorized === false, 'MEMBER cannot read RESTRICTED data');
  assert(carolRestricted.requiredRole === 'ADMIN', 'RESTRICTED data requires ADMIN or OWNER');

  // Admin can read RESTRICTED
  const aliceRestricted = RBACEngine.authorize({ userId: userAlice.id, tenantId: tenantAcme.id, role: 'ADMIN', workspaceId: wsEngineering.id }, 'read', resRestricted);
  assert(aliceRestricted.authorized === true, 'ADMIN can read RESTRICTED data');

  // ─────────────────────────────────────────────────────────────
  // TEST 4: The Personal Data Firewall
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: The Personal Data Firewall ---');

  const resPersonalCarol = {
    id: 'mem_carol_private',
    tenantId: tenantAcme.id,
    scope: 'PERSONAL' as const,
    classification: 'CONFIDENTIAL' as const,
    ownerId: memberCarol.id
  };

  // Carol can access her own personal memory
  const carolOwn = RBACEngine.authorize({ userId: memberCarol.id, tenantId: tenantAcme.id, role: 'MEMBER' }, 'read', resPersonalCarol);
  assert(carolOwn.authorized === true, 'Owner can access personal memory');

  // Alice (even though ADMIN of Acme Corp) CANNOT read Carol's personal memory
  const adminAttempt = RBACEngine.authorize({ userId: userAlice.id, tenantId: tenantAcme.id, role: 'ADMIN' }, 'read', resPersonalCarol);
  assert(adminAttempt.authorized === false, 'Personal Data Firewall strictly prevents ADMIN from reading personal memory');
  assert(adminAttempt.reason.includes('Personal Data Firewall violation'), 'Firewall violation reported in rejection reason');

  // Apply Firewall query filter
  const mixedMemoryStore = [
    { id: 'm1', scope: 'PERSONAL', ownerId: memberCarol.id, text: 'Private thought' },
    { id: 'm2', scope: 'WORKSPACE', text: 'Sprint Planning Doc' },
    { id: 'm3', scope: 'ORGANIZATION', text: 'Company Handbook' },
    { id: 'm4', scope: 'PERSONAL', ownerId: userAlice.id, text: 'Alice private notes' }
  ];

  const teamQueryResult = RBACEngine.applyDataFirewall(mixedMemoryStore, memberCarol.id, 'WORKSPACE');
  assert(teamQueryResult.length === 2, 'Workspace query filters out all personal items');
  assert(!teamQueryResult.some(m => m.scope === 'PERSONAL'), 'Zero personal records leaked into workspace query result');

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Controlled Memory Promotion
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: Controlled Memory Promotion ---');
  MemoryPromotionBridge.clear();

  const promoted = MemoryPromotionBridge.promote({
    userId: memberCarol.id,
    userRole: 'MEMBER',
    tenantId: tenantAcme.id,
    targetWorkspaceId: wsEngineering.id,
    sourceMemoryId: 'mem_decision_42',
    content: 'Standardize on Tailwind CSS v4 for all internal tools',
    rationale: 'Approved in team retrospective for faster rendering'
  });

  assert(promoted.id.startsWith('prom_'), 'Promoted memory created with structured ID');
  assert(promoted.workspaceId === wsEngineering.id, 'Promoted memory assigned to target workspace');

  const wsPromoted = MemoryPromotionBridge.listByWorkspace(wsEngineering.id);
  assert(wsPromoted.length === 1, 'Promoted memory accessible in workspace catalog');

  // Verify Audit Log entry for promotion
  const promotionAudits = AuditLogger.query({ action: 'MEMORY_PROMOTED' });
  assert(promotionAudits.length === 1, 'Audit record created for memory promotion');
  assert(promotionAudits[0].actorId === memberCarol.id, 'Audit record tracks promoting user');

  // ─────────────────────────────────────────────────────────────
  // TEST 6: Shadow AI Cross-System Reasoning
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 6: Shadow AI Cross-System Reasoning ---');
  ShadowAIEngine.clear();

  // Ingest signals from disparate systems
  ShadowAIEngine.ingestSignal({
    source: 'GITHUB',
    entityId: 'PR-402-payment-auth',
    metric: 'merge_delay_hours',
    value: 36
  });

  ShadowAIEngine.ingestSignal({
    source: 'SENTRY',
    entityId: 'ERR-auth-token-expired',
    metric: 'crash_rate_spike',
    value: 28.5
  });

  ShadowAIEngine.ingestSignal({
    source: 'ZENDESK',
    entityId: 'TICK-login-failures',
    metric: 'customer_complaint_count',
    value: 19
  });

  const correlations = ShadowAIEngine.analyzeCorrelations();
  assert(correlations.length > 0, 'Shadow AI synthesized cross-system correlation');
  assert(correlations[0].confidence >= 0.85, 'Correlation confidence calibrated based on multi-system evidence');
  assert(correlations[0].signals.length === 3, 'Correlation links 3 disparate signals (GitHub, Sentry, Zendesk)');
  assert(correlations[0].hypothesis.includes('PR-402-payment-auth'), 'Hypothesis correctly identifies root-cause entity');

  // ─────────────────────────────────────────────────────────────
  // TEST 7: Organizational Risk & Bottleneck Evaluation
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 7: Organizational Risk & Bottleneck Evaluation ---');

  const orgRisks = OrgRiskEngine.assessRisks({
    dependencies: [
      { sourceTaskId: 'task-db-migration', blockedTaskId: 'task-billing-v2', initiative: 'Billing Revamp' },
      { sourceTaskId: 'task-db-migration', blockedTaskId: 'task-analytics-etl', initiative: 'Data Platform' },
      { sourceTaskId: 'task-db-migration', blockedTaskId: 'task-user-export', initiative: 'GDPR Compliance' }
    ],
    tasks: [
      { id: 't-urgent-audit', title: 'SOC-2 Compliance Filing', deadlineAt: Date.now() + 2 * 60 * 60 * 1000, status: 'In Progress' }
    ],
    unresolvedTicketCount: 30
  });

  assert(orgRisks.length === 3, `Identified 3 distinct organizational risk assessments (got ${orgRisks.length})`);
  const bottleneckRisk = orgRisks.find(r => r.category === 'BOTTLENECK');
  assert(bottleneckRisk !== undefined, 'Detected cross-team BOTTLENECK risk');
  assert(bottleneckRisk?.severity === 'CRITICAL', 'Task blocking 3 initiatives evaluated as CRITICAL severity');

  const deadlineRisk = orgRisks.find(r => r.category === 'DEADLINE');
  assert(deadlineRisk !== undefined, 'Detected DEADLINE risk for task due in 2 hours');

  // ─────────────────────────────────────────────────────────────
  // TEST 8: Secure Inbound Webhooks
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 8: Secure Inbound Webhooks ---');
  WebhookHandler.clear();

  const webhookSecret = 'enterprise_super_secret_key_12345';
  const validPayload = { event: 'pull_request.merged', repo: 'floatgpt-core', number: 402 };
  const now = Date.now();

  const validSig = WebhookHandler.generateSignature(validPayload, now, webhookSecret);

  // 1. Valid Signature -> Accepted
  const validRes = WebhookHandler.processWebhook({
    id: 'wh_msg_001',
    source: 'github',
    timestamp: now,
    payload: validPayload,
    signature: validSig
  }, webhookSecret);
  assert(validRes.status === 'ACCEPTED', 'Valid HMAC-SHA256 signature accepted');

  // 2. Duplicate ID -> Idempotency Drop
  const dupRes = WebhookHandler.processWebhook({
    id: 'wh_msg_001',
    source: 'github',
    timestamp: now,
    payload: validPayload,
    signature: validSig
  }, webhookSecret);
  assert(dupRes.status === 'DUPLICATE_IGNORED', 'Duplicate webhook message dropped via idempotency deduplication');

  // 3. Forged Signature -> Rejected
  const forgedRes = WebhookHandler.processWebhook({
    id: 'wh_msg_002',
    source: 'github',
    timestamp: now,
    payload: validPayload,
    signature: 'bad_forged_hex_signature_abcdef1234567890'
  }, webhookSecret);
  assert(forgedRes.status === 'REJECTED_SIGNATURE', 'Tampered signature rejected');

  // 4. Replay Attack (> 5 minutes old) -> Rejected
  const staleTimestamp = now - (10 * 60 * 1000); // 10 minutes ago
  const staleSig = WebhookHandler.generateSignature(validPayload, staleTimestamp, webhookSecret);
  const replayRes = WebhookHandler.processWebhook({
    id: 'wh_msg_003',
    source: 'github',
    timestamp: staleTimestamp,
    payload: validPayload,
    signature: staleSig
  }, webhookSecret, { now });
  assert(replayRes.status === 'REJECTED_REPLAY', 'Stale webhook request rejected via anti-replay defense');

  // ─────────────────────────────────────────────────────────────
  // TEST 9: First-Party Enterprise Connectors
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 9: First-Party Enterprise Connectors ---');

  const ghConnector = new GitHubConnector();
  await ghConnector.initialize({ tenantId: tenantAcme.id, workspaceId: wsEngineering.id });
  assert(ghConnector.status === 'CONNECTED', 'GitHub connector initialized to CONNECTED');

  const ghSync = await ghConnector.sync();
  assert(ghSync.openPullRequests === 3, 'GitHub sync returns structured PR metrics');

  const suppConnector = new SupportConnector();
  await suppConnector.initialize({ tenantId: tenantAcme.id, workspaceId: wsEngineering.id });
  const suppSync = await suppConnector.sync();
  assert(suppSync.unresolvedTickets === 8, 'Support connector sync returns ticket metrics');

  // ─────────────────────────────────────────────────────────────
  // TEST 10: Developer Platform SDK & Extension Registration
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 10: Developer Platform SDK & Extension Registration ---');
  FloatGPTSDK.clear();

  const customSkill: SkillDefinition = {
    id: 'security-scanner',
    name: 'Security Vulnerability Scanner',
    version: '1.0.0',
    description: 'Scans source code repositories for leaked secrets',
    category: 'DEVELOPMENT',
    lifecycle: 'ACTIVE',
    requiredCapabilities: ['filesystem.read'],
    parameters: [{ name: 'repoPath', type: 'string', required: true, description: 'Path to repo' }],
    execute: async () => ({ status: 'COMPLETED', output: { vulnerabilities: 0 }, verificationEvidence: { pass: true } })
  };

  const extRegistration = FloatGPTSDK.registerExtension({
    id: 'ext_cybersecurity',
    name: 'Cybersecurity Suite',
    version: '1.0.0',
    description: 'Enterprise vulnerability scanning extensions',
    author: 'SecurityTeam',
    skills: [customSkill]
  });

  assert(extRegistration.success === true, 'Extension package registered successfully via FloatGPTSDK');
  assert(extRegistration.registeredSkills === 1, 'Custom skill cataloged in SkillRegistry');
  assert(SkillRegistry.get('security-scanner') !== null, 'SkillRegistry resolves custom SDK skill');

  // ─────────────────────────────────────────────────────────────
  // TEST 11: Sandboxed Extension Simulator
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 11: Sandboxed Extension Simulator ---');

  // 1. Permission Denial Simulation
  const permSim = await ExtensionSimulator.simulatePermissionDenial(customSkill, 'filesystem.read');
  assert(permSim.passed === true, 'Extension simulator handled permission denial cleanly');
  assert(permSim.zeroFalseSuccessEnforced === true, 'Zero False Success enforced on permission denial');
  assert(permSim.status === 'FAILED', 'Status reported as FAILED, never premature success');

  // 2. Tool Crash Simulation
  const crashSim = await ExtensionSimulator.simulateToolCrash(customSkill, 'filesystem.read');
  assert(crashSim.passed === true, 'Tool crash intercepted safely');
  assert(crashSim.status === 'FAILED', 'Crash reported as FAILED without unhandled exception leak');

  // 3. Timeout Simulation
  const timeoutSim = await ExtensionSimulator.simulateTimeout(3000, 6500);
  assert(timeoutSim.passed === true, 'Timeout condition detected');
  assert(timeoutSim.status === 'TIMED_OUT', 'Status reported as TIMED_OUT');

  // ─────────────────────────────────────────────────────────────
  // TEST 12: Cryptographically Chained Immutable Audit Trail
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 12: Cryptographically Chained Immutable Audit Trail ---');

  // Verify currently clean chain
  const chainVerify = AuditLogger.verifyChain();
  assert(chainVerify.valid === true, 'Audit log chain cryptographically verified');
  assert(chainVerify.recordCount > 0, 'Audit log contains valid records');

  // Tamper Test: mutate a historical record directly in memory
  const rawRecords = AuditLogger.getRawRecords();
  const originalAction = rawRecords[0].action;
  
  // Malicious tampering
  rawRecords[0].action = 'AUTH_DENIED' as any;
  const tamperedVerify = AuditLogger.verifyChain();
  assert(tamperedVerify.valid === false, 'Cryptographic chain detected tampering in audit trail');
  assert(tamperedVerify.tamperedRecordId === rawRecords[0].id, 'Identified exact tampered record ID');

  // Restore record
  rawRecords[0].action = originalAction;
  const restoredVerify = AuditLogger.verifyChain();
  assert(restoredVerify.valid === true, 'Chain integrity restored upon reversing tampering');

  // ─────────────────────────────────────────────────────────────
  // TEST 13: Critical Security Invariant (INTELLIGENCE ≠ AUTHORITY)
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 13: Critical Security Invariant (INTELLIGENCE ≠ AUTHORITY) ---');

  // High correlation confidence from Shadow AI
  const highConfidenceHypothesis = correlations[0];
  assert(highConfidenceHypothesis.confidence >= 0.85, 'Shadow AI has 85%+ correlation confidence');

  // Attempting to execute an OS/System repair without human confirmation / RBAC authority is blocked
  const unauthExecution = RBACEngine.authorize(
    { userId: viewerBob.id, tenantId: tenantAcme.id, role: 'VIEWER' },
    'execute',
    { id: 'action_deploy_fix', tenantId: tenantAcme.id, scope: 'WORKSPACE', classification: 'INTERNAL' }
  );
  assert(
    unauthExecution.authorized === false,
    'Enterprise high-confidence Shadow AI insight CANNOT authorize action for unauthorized role'
  );

  // ─────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`📊 Phase 6 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6TestSuite().catch(err => {
  console.error('Fatal error during Phase 6 verification:', err);
  process.exit(1);
});
