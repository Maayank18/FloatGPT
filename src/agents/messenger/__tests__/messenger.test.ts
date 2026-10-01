/**
 * FloatGPT — Messenger Agent Comprehensive Test Suite
 * 
 * Tests the 7 Core Acceptance Criteria:
 * 1. Intent Parsing (instant send, scheduled send, relative & absolute times)
 * 2. Recipient Resolution & Disambiguation (single match vs ambiguous matches)
 * 3. Authentication Enforcement (reject unauthenticated, proceed authenticated)
 * 4. Actual Execution & Send Verification (submission confirmation)
 * 5. Idempotency Engine (prevents duplicate dispatch)
 * 6. Persistent Scheduler & Restart Recovery
 * 7. Action Broker Integration (CapabilityRegistry + ActionBroker.dispatch + ActionJournal)
 */



import { MessageIntentParser } from '../core/MessageIntentParser';
import { RecipientResolver } from '../core/RecipientResolver';
import { ContactStore } from '../core/ContactStore';
import { MessageComposer } from '../core/MessageComposer';
import { MessageExecutor } from '../core/MessageExecutor';
import { MessageScheduler } from '../scheduler/MessageScheduler';
import { MessageJobStore } from '../scheduler/MessageJobStore';
import { WhatsAppAuth } from '../whatsapp/WhatsAppAuth';
import { LinkedInAuth } from '../linkedin/LinkedInAuth';
import { MessengerAgent } from '../core/MessengerAgent';
import { ActionBroker } from '../../../fabric/actionBroker';
import { StructuredAction } from '../../../fabric/protocol';
import { CapabilityRegistry } from '../../../fabric/registry';

async function runTests() {
  console.log('========================================================');
  console.log('🧪 Starting FloatGPT Messenger Agent Test Suite');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // Pre-seed test contacts and test credentials for headless unit test suite
  await ContactStore.seedForTesting();
  await WhatsAppAuth.seedForTesting();
  await LinkedInAuth.seedForTesting();

  // ─── Test 1: Intent Parsing ─────────────────────────────────
  console.log('--- Test 1: Natural-Language Intent Parsing ---');
  {
    const parsed1 = MessageIntentParser.parse('Float, send Adam a WhatsApp saying "Hi Adam, are you free today?"');
    assert(parsed1 !== null, 'Parses quoted instant WhatsApp send');
    assert(parsed1?.platform === 'whatsapp', 'Identifies platform as whatsapp');
    assert(parsed1?.action === 'send_message', 'Identifies action as send_message');
    assert(parsed1?.recipientQuery === 'Adam', `Extracts recipient "Adam" (got "${parsed1?.recipientQuery}")`);
    assert(parsed1?.messageContent === 'Hi Adam, are you free today?', `Extracts exact message content (got "${parsed1?.messageContent}")`);

    const parsed2 = MessageIntentParser.parse('Schedule a WhatsApp to Rahul tomorrow at 4 PM saying Happy Birthday!');
    assert(parsed2?.action === 'schedule_message', 'Identifies action as schedule_message');
    assert(parsed2?.recipientQuery === 'Rahul', `Extracts recipient "Rahul" (got "${parsed2?.recipientQuery}")`);
    assert(parsed2?.scheduledAt !== null, 'Generates scheduledAt ISO string');
    assert(typeof parsed2?.scheduledEpochMs === 'number', 'Generates scheduled epoch ms');

    const parsed3 = MessageIntentParser.parse('Send this to Sarah on LinkedIn saying Thanks for connecting.');
    assert(parsed3?.platform === 'linkedin', 'Identifies platform as linkedin');
    assert(parsed3?.recipientQuery === 'Sarah', `Extracts recipient "Sarah" on LinkedIn (got "${parsed3?.recipientQuery}")`);

    const parsed4 = MessageIntentParser.parse('Show my scheduled messages');
    assert(parsed4?.action === 'list_scheduled', 'Identifies list_scheduled action');

    // Direct "send <msg> to <recipient> on whatsapp" pattern
    const parsedMummy = MessageIntentParser.parse('please send Hi to Mummy on Whatsapp');
    assert(parsedMummy !== null, 'Parses direct send <msg> to <recipient> on whatsapp');
    assert(parsedMummy?.recipientQuery === 'Mummy', `Extracts recipient "Mummy" (got "${parsedMummy?.recipientQuery}")`);
    assert(parsedMummy?.messageContent === 'Hi', `Extracts message "Hi" (got "${parsedMummy?.messageContent}")`);
    assert(parsedMummy?.platform === 'whatsapp', 'Identifies platform as whatsapp');

    const parsedNoPlatform = MessageIntentParser.parse('please send HI to Mummy');
    assert(parsedNoPlatform !== null, 'Parses send-to-contact even without saying WhatsApp');
    assert(parsedNoPlatform?.recipientQuery === 'Mummy', `Extracts Mummy without platform word (got "${parsedNoPlatform?.recipientQuery}")`);
    assert(parsedNoPlatform?.messageContent === 'HI', `Extracts HI (got "${parsedNoPlatform?.messageContent}")`);

    const parsedTonight = MessageIntentParser.parse('Schedule a WhatsApp to Rahul tonight at 8:00 PM saying Happy Birthday!');
    assert(parsedTonight?.action === 'schedule_message', 'Parses tonight as schedule_message');
    assert(typeof parsedTonight?.scheduledEpochMs === 'number', 'Resolves tonight 8:00 PM to an epoch timestamp');

    const relativeSched = MessageIntentParser.parse('Schedule a WhatsApp to Mom in 45 minutes saying I am on my way');
    assert(relativeSched?.action === 'schedule_message', 'Parses relative "in 45 minutes" schedule');
    if (relativeSched?.scheduledEpochMs) {
      const delta = relativeSched.scheduledEpochMs - Date.now();
      assert(delta > 44 * 60 * 1000 && delta < 46 * 60 * 1000, `Relative schedule is ~45 minutes out (delta=${Math.round(delta / 1000)}s)`);
    }

    const parsedMonday = MessageIntentParser.parse('Schedule a WhatsApp to Rahul on Monday at 9 AM saying Hello');
    assert(parsedMonday?.action === 'schedule_message', 'Weekday schedule is schedule_message');
    if (parsedMonday?.scheduledEpochMs) {
      const mondayDate = new Date(parsedMonday.scheduledEpochMs);
      assert(mondayDate.getDay() === 1, `Monday schedule lands on Monday (got day ${mondayDate.getDay()})`);
      assert(mondayDate.getHours() === 9, `Monday 9 AM (got ${mondayDate.getHours()})`);
      assert(mondayDate.getTime() > Date.now() - 1000, 'Weekday schedule is not in the past');
    }

    const parsedDate = MessageIntentParser.parse('Schedule a WhatsApp to Rahul on 12 September at 9 PM saying Hello');
    assert(parsedDate?.action === 'schedule_message', 'Calendar-date schedule is schedule_message');
    if (parsedDate?.scheduledEpochMs) {
      const cal = new Date(parsedDate.scheduledEpochMs);
      assert(cal.getDate() === 12, `Day 12 (got ${cal.getDate()})`);
      assert(cal.getMonth() === 8, `September (got month ${cal.getMonth()})`);
      assert(cal.getHours() === 21, `9 PM (got ${cal.getHours()})`);
    }

    assert(parsedNoPlatform?.action === 'send_message', 'Instant send without a time stays send_message');
  }

  // ─── Test 2: Recipient Resolution & Disambiguation ───────────
  console.log('\n--- Test 2: Recipient Resolution & Ambiguity Safety ---');
  {
    // Single confident match
    const rahulRes = await RecipientResolver.resolve('Rahul Verma', 'whatsapp');
    assert(rahulRes.success === true, 'Resolves exact full name "Rahul Verma"');
    if (rahulRes.success) {
      assert(rahulRes.recipient.identifier === '+919988776655', 'Resolves correct phone for Rahul');
    }

    // Ambiguous match (Two contacts named Adam: Adam Sharma & Adam Verma)
    const adamRes = await RecipientResolver.resolve('Adam', 'whatsapp');
    assert(adamRes.success === false && adamRes.isAmbiguous === true, 'Detects ambiguity when multiple "Adam"s exist');
    if (!adamRes.success && adamRes.isAmbiguous) {
      assert(adamRes.disambiguation.candidates.length === 2, 'Identifies both Adam Sharma and Adam Verma as candidates');
      assert(adamRes.disambiguation.disambiguationPrompt.includes('Adam Sharma') && adamRes.disambiguation.disambiguationPrompt.includes('Adam Verma'), 'Generates interactive disambiguation prompt listing both');
    }

    // Direct phone number input
    const directRes = await RecipientResolver.resolve('+919876543210', 'whatsapp');
    assert(directRes.success === true, 'Direct phone input automatically resolves');
  }

  // ─── Test 3: Authentication Guard ────────────────────────────
  console.log('\n--- Test 3: Authentication Guard ---');
  {
    // Check initial authenticated state
    assert(await WhatsAppAuth.isAuthenticated(), 'WhatsApp is authenticated by default');

    // Test disconnect
    await WhatsAppAuth.disconnect();
    assert(!(await WhatsAppAuth.isAuthenticated()), 'WhatsApp reports unauthenticated after disconnect');

    // Attempting send while unauthenticated MUST fail with AUTH_REQUIRED
    const dummyRecipient = {
      id: 'test_recip',
      name: 'Adam Sharma',
      identifier: '+919876543210',
      platform: 'whatsapp' as const,
      verified: true
    };
    const sendWhileUnauthed = await MessageExecutor.execute(
      'whatsapp',
      dummyRecipient,
      { content: 'Testing auth' }
    );
    assert(!sendWhileUnauthed.success, 'Send is blocked when unauthenticated');
    assert(sendWhileUnauthed.error?.includes('AUTH_REQUIRED') || false, 'Error message explicitly states AUTH_REQUIRED');

    // Re-connect
    await WhatsAppAuth.connectAccount({ phoneNumber: '+919876543210', accountName: 'Test Account' });
    assert(await WhatsAppAuth.isAuthenticated(), 'WhatsApp is re-authenticated successfully');
  }

  // ─── Test 4: Actual Execution & Send Verification ────────────
  console.log('\n--- Test 4: Actual Execution & Verification ---');
  {
    const recipient = {
      id: 'contact_adam_sharma',
      name: 'Adam Sharma',
      identifier: '+919876543210',
      phoneNormalized: '+919876543210',
      platform: 'whatsapp' as const,
      verified: true
    };

    const sendResult = await MessageExecutor.execute(
      'whatsapp',
      recipient,
      { content: 'Hi Adam, are you free today?' }
    );

    assert(sendResult.success === true, 'Message executed successfully');
    assert(sendResult.status === 'VERIFIED', 'Execution status is VERIFIED');
    assert(sendResult.verificationStatus === 'SEND_CONFIRMED', 'Verification status is SEND_CONFIRMED');
    assert(sendResult.platformMessageId?.startsWith('wamid') || false, 'Platform message ID generated');
    assert(sendResult.details?.includes('WhatsApp Web') || false, 'Dispatched via WhatsApp Web session by default');

    // Test clientType preference toggling
    await WhatsAppAuth.setClientType('web');
    const clientTypeAfterSet = await WhatsAppAuth.getClientType();
    assert(clientTypeAfterSet === 'web', 'Switches WhatsApp client preference to web');

    const webSendResult = await MessageExecutor.execute(
      'whatsapp',
      recipient,
      { content: 'Hi Adam, web dispatch test' },
      { idempotencyKey: `test_idem_web_${Date.now()}` }
    );
    assert(webSendResult.success === true, 'Web dispatch executed successfully');
    assert(webSendResult.details?.includes('WhatsApp Web') || false, 'Details reflect web client dispatch');

    // Reset back to desktop
    await WhatsAppAuth.setClientType('desktop');
    assert((await WhatsAppAuth.getClientType()) === 'desktop', 'Resets client preference to desktop');
  }

  // ─── Test 11: Single-Tab Reuse Engine ────────────────────────
  console.log('\n--- Test 11: WhatsApp Single-Tab Reuse Engine ---');
  {
    const { buildWindowsWebReuseScript, buildMacWebReuseScript, buildWindowsDesktopScript, WhatsAppTabManager } = await import('../whatsapp/WhatsAppTabManager');
    const sampleUrl = 'https://web.whatsapp.com/send/?phone=919876543210&text=Hello';
    const winScript = buildWindowsWebReuseScript(sampleUrl, { phone: '919876543210', name: 'Adam', text: 'Hello' });
    assert(winScript.includes('Get-Process') || winScript.includes('Find-WaWindow'), 'Windows script finds an existing WhatsApp/browser window');
    assert(winScript.includes('IsIconic'), 'Windows script only restores the browser if it was actually minimized');
    assert(winScript.includes("SendKeys('^%n')"), 'Reuse path opens the in-app new-chat search instead of reloading the URL');
    assert(!winScript.includes("SendKeys('^l')"), 'Reuse path never hijacks the address bar (that reloads WhatsApp Web)');
    assert(winScript.includes('keybd_event'), 'Windows send uses hardware Enter so the composer actually submits');
    assert(winScript.includes('Set-Clipboard -Value $oldClip') || winScript.includes('Set-Clipboard -Value $oldClip'), 'Windows script restores original clipboard');
    assert(winScript.includes("if (-not $reused)"), 'Cold-launch Start-Process is gated behind reuse failure');
    assert((winScript.match(/Start-Process/g) || []).length === 1, 'Windows web script cold-launches at most once');
    assert(!winScript.includes('_blank'), 'Windows script never opens a named _blank tab');

    const macScript = buildMacWebReuseScript(sampleUrl);
    assert(macScript.includes('web.whatsapp.com'), 'macOS script searches existing WhatsApp Web tabs');
    assert(macScript.includes('set foundTab to true'), 'macOS script reuses the existing tab');
    assert(!macScript.includes('set URL of t to targetUrl'), 'macOS reuse does not reload the tab URL');
    assert(macScript.includes('if not foundTab then'), 'macOS cold-open only runs when no tab exists');

    const desktopScript = buildWindowsDesktopScript('whatsapp://send?phone=919876543210&text=Hi');
    assert(desktopScript.includes("whatsapp://send"), 'Desktop script uses native whatsapp:// protocol');
    assert(desktopScript.includes('Get-Process'), 'Desktop script reuses an existing native WhatsApp window');

    WhatsAppTabManager.resetForTesting();
    const order: number[] = [];
    await Promise.all([
      WhatsAppTabManager.enqueue(async () => { await new Promise(r => setTimeout(r, 20)); order.push(1); return 1; }),
      WhatsAppTabManager.enqueue(async () => { order.push(2); return 2; }),
      WhatsAppTabManager.enqueue(async () => { order.push(3); return 3; })
    ]);
    assert(order.join(',') === '1,2,3', `Single-tab queue serializes dispatches (got ${order.join(',')})`);
  }

  // ─── Test 12: Sleep-wake overdue confirmation ────────────────
  console.log('\n--- Test 12: Sleep/Wake Overdue Recovery ---');
  {
    MessageScheduler.resetForTesting();
    const recipient = {
      id: 'contact_rahul_verma',
      name: 'Rahul Verma',
      identifier: '+919988776655',
      phoneNormalized: '+919988776655',
      platform: 'whatsapp' as const,
      verified: true
    };
    const overdueJob = await MessageScheduler.schedule({
      platform: 'whatsapp',
      recipient,
      message: { content: 'This should wait for confirmation after sleep' },
      scheduledAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      timezone: 'UTC'
    });
    await MessageJobStore.updateJobStatus(overdueJob.id, 'SCHEDULED');
    MessageScheduler.resetForTesting();
    await MessageScheduler.init();
    const reloaded = await MessageJobStore.getJob(overdueJob.id);
    assert(reloaded?.status === 'OVERDUE_PENDING', `Overdue sleep-wake job waits for user (got ${reloaded?.status})`);
    await MessageScheduler.cancelJob(overdueJob.id);
    await MessageJobStore.deleteJob(overdueJob.id);
    MessageScheduler.resetForTesting();
  }

  // ─── Test 5: Idempotency Protection ──────────────────────────
  console.log('\n--- Test 5: Idempotency Protection ---');
  {
    const recipient = {
      id: 'contact_adam_sharma',
      name: 'Adam Sharma',
      identifier: '+919876543210',
      phoneNormalized: '+919876543210',
      platform: 'whatsapp' as const,
      verified: true
    };

    const idempotencyKey = 'test_idem_key_12345';
    const firstSend = await MessageExecutor.execute(
      'whatsapp',
      recipient,
      { content: 'Idempotency test payload' },
      { idempotencyKey }
    );
    assert(firstSend.success === true, 'First attempt sends message');

    // Second execution with same idempotency key
    const secondSend = await MessageExecutor.execute(
      'whatsapp',
      recipient,
      { content: 'Idempotency test payload' },
      { idempotencyKey }
    );
    assert(secondSend.success === true, 'Second attempt succeeds via idempotent replay');
    assert(secondSend.details?.includes('Idempotent Replay') || false, 'Details show idempotent replay without duplicate dispatch');
    assert(secondSend.operationId === firstSend.operationId, 'Operation ID matches previous operation');
  }

  // ─── Test 6: Persistent Scheduler & Restart Recovery ─────────
  console.log('\n--- Test 6: Persistent Scheduler & Restart Recovery ---');
  {
    const recipient = {
      id: 'contact_rahul_verma',
      name: 'Rahul Verma',
      identifier: '+919988776655',
      phoneNormalized: '+919988776655',
      platform: 'whatsapp' as const,
      verified: true
    };

    const futureTime = new Date(Date.now() + 60000).toISOString();
    const job = await MessageScheduler.schedule({
      platform: 'whatsapp',
      recipient,
      message: { content: 'Happy Birthday Rahul! 🎉' },
      scheduledAt: futureTime,
      timezone: 'UTC'
    });

    assert(job.id.startsWith('job_'), 'Scheduled job created with valid ID');
    assert(job.status === 'SCHEDULED', 'Job initial status is SCHEDULED');

    // Verify job exists in MessageJobStore
    const storedJob = await MessageJobStore.getJob(job.id);
    assert(storedJob !== null, 'Job persisted in MessageJobStore (survives restart)');
    assert(storedJob?.message.content === 'Happy Birthday Rahul! 🎉', 'Persisted job content is preserved');

    // Cancel job
    const cancelled = await MessageScheduler.cancelJob(job.id);
    assert(cancelled === true, 'Job can be cancelled by user before execution');
    const checkCancelled = await MessageJobStore.getJob(job.id);
    assert(checkCancelled?.status === 'CANCELLED', 'Job status is updated to CANCELLED in persistent store');
  }

  // ─── Test 7: Action Broker Integration ───────────────────────
  console.log('\n--- Test 7: Action Broker & Fabric Capability Integration ---');
  {
    assert(CapabilityRegistry.has('messaging.whatsapp.send'), 'messaging.whatsapp.send registered in CapabilityRegistry');
    assert(CapabilityRegistry.has('messaging.whatsapp.schedule'), 'messaging.whatsapp.schedule registered in CapabilityRegistry');
    assert(CapabilityRegistry.has('messaging.linkedin.send'), 'messaging.linkedin.send registered in CapabilityRegistry');

    const action: StructuredAction = {
      actionId: `act_${Date.now()}`,
      capability: 'messaging.whatsapp.send',
      domain: 'messaging',
      target: { application: 'Rahul Verma', content: 'Message via ActionBroker' },
      arguments: { recipient: 'Rahul Verma', message: 'Message via ActionBroker' },
      source: 'user_explicit',
      risk: 'LEVEL_2_SENSITIVE',
      requiresConfirmation: false,
      reversible: false,
      description: 'Send WhatsApp message to Rahul Verma'
    };

    const brokerResult = await ActionBroker.dispatch(action);
    assert(brokerResult.success === true, 'ActionBroker dispatches messaging action through MessengerExecutionAdapter');
    assert(brokerResult.status === 'COMPLETED', 'ActionBroker status is COMPLETED');
    assert(brokerResult.verified === true, 'ActionBroker verifies the post-execution state');
  }

  // ─── Test 8: End-to-End MessengerAgent Dispatch ──────────────
  console.log('\n--- Test 8: End-to-End MessengerAgent Intent Pipeline ---');
  {
    const e2eResult = await MessengerAgent.handleUserInstruction(
      'Float, send Rahul Verma a WhatsApp saying "Meeting confirmed for 5 PM."'
    );
    assert(e2eResult.handled === true, 'MessengerAgent handles end-to-end user instruction');
    assert(e2eResult.message?.includes('Message Sent Successfully') || false, 'MessengerAgent returns formatted confirmation message');
  }

  // ─── Test 9: Multi-Turn Slot Filling & Contact Tag Resolution ──
  console.log('\n--- Test 9: Multi-Turn Slot Filling & Contact Tag Matching ---');
  {
    // 1. Save Kanchan Garg with tag/company "Mummy"
    await ContactStore.saveContact({
      name: 'Kanchan Garg',
      identifier: '+919953314976',
      platform: 'whatsapp',
      metadata: { company: 'Mummy' }
    });

    // 2. Direct send "please send Hi to Mummy on Whatsapp"
    const directMummy = await MessengerAgent.handleUserInstruction('please send Hi to Mummy on Whatsapp');
    assert(directMummy.handled === true, 'MessengerAgent handles direct "send Hi to Mummy on Whatsapp"');
    assert(directMummy.message?.includes('Kanchan Garg') || false, 'Resolves "Mummy" to "Kanchan Garg"');
    assert(directMummy.message?.includes('Message Sent Successfully') || false, 'Message sent successfully to Mummy');

    // 3. Multi-turn: Turn 1 prompts for missing message
    const turn1 = await MessengerAgent.handleUserInstruction('send a whatsapp to Mummy');
    assert(turn1.handled === true, 'Turn 1 intercepts "send a whatsapp to Mummy"');
    assert(MessengerAgent.hasPendingSession(), 'Pending session created awaiting message content');

    // 4. Multi-turn: Turn 2 supplies missing message "Hello"
    const turn2 = await MessengerAgent.handleUserInstruction('Hello');
    assert(turn2.handled === true, 'Turn 2 fulfills missing message slot');
    assert(!MessengerAgent.hasPendingSession(), 'Pending session cleared after execution');
    assert(turn2.message?.includes('Message Sent Successfully') || false, 'Multi-turn successfully dispatched');
  }

  // ─── Test 10: WhatsApp Web vs Desktop Selection Flow ─────────
  console.log('\n--- Test 10: WhatsApp Web vs Desktop Selection Flow ---');
  {
    // A. Direct Intent with "on whatsapp web" bypasses prompt
    const directWeb = await MessengerAgent.handleUserInstruction('send Hi to Mummy on Whatsapp web');
    assert(directWeb.handled === true, 'Direct "on whatsapp web" handled immediately');
    assert(directWeb.message?.includes('Message Sent Successfully') || false, 'Direct web intent sends without prompt');
    assert(!MessengerAgent.hasPendingSession(), 'No pending session left after direct web intent');

    // B. "Ask" now defaults to the in-app WhatsApp Web session (actual Send, not Desktop prefill).
    await WhatsAppAuth.setClientType('ask');
    assert((await WhatsAppAuth.getClientType()) === 'ask', 'WhatsApp client preference set to "ask"');

    const promptTurn = await MessengerAgent.handleUserInstruction('please send How are you to Mummy on Whatsapp');
    assert(promptTurn.handled === true, 'MessengerAgent intercepts prompt when clientType is "ask"');
    assert(MessengerAgent.hasPendingSession(), 'Ask preference waits for Web vs Desktop');
    assert(promptTurn.message?.includes('Where should I send') || promptTurn.actionExecuted === 'ask_client_preference', 'Ask mode prompts Web vs Desktop');

    const webChoice = await MessengerAgent.handleUserInstruction('1');
    assert(webChoice.handled === true, 'Choosing Web continues the send');
    assert(!MessengerAgent.hasPendingSession() || webChoice.actionExecuted === 'confirm_send', 'Session advances after Web choice');
  }

  console.log('\n========================================================');
  console.log(`🏁 Test Results: ${passed} passed, ${failed} failed`);
  console.log('========================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal error in test runner:', err);
  process.exit(1);
});
