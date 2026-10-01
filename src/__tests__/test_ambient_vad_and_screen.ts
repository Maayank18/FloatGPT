/**
 * Verification Suite for Screen Capture, Vision Intelligence,
 * OS Shortcuts (Zoom In/Out, Tab Switching, Media Play/Pause),
 * and Ambient Wake Words (Hey Float, Hey Flow, VAD).
 */

import assert from 'assert';

function asString(value: string): string {
  return value;
}
function asBoolean(value: boolean): boolean {
  return value;
}
import { detectMediaIntent } from '../platform/osMedia';
import { detectLocalOsIntent } from '../platform/osLaunch';
import { tryFastRoute } from '../ai/fastRouter';
import { resolveAlias } from '../agent/aliasResolver';

async function runTests() {
  console.log('🧪 Starting Ambient VAD, Screen Understanding & OS Shortcuts Test Suite...\n');

  // --- 1. Screen Zoom In / Zoom Out / Reset ---
  console.log('--- TEST 1: Screen Zoom & Magnification Intents ---');
  const zoomIn = detectMediaIntent('zoom in');
  assert(zoomIn !== null && zoomIn.action === 'zoom_in', 'Should detect zoom in');
  console.log('  ✅ PASS: "zoom in" -> action: zoom_in');

  const zoomInEnlarge = detectMediaIntent('hey float please enlarge screen');
  assert(zoomInEnlarge !== null && zoomInEnlarge.action === 'zoom_in', 'Should detect enlarge screen as zoom_in');
  console.log('  ✅ PASS: "hey float please enlarge screen" -> action: zoom_in');

  const zoomOut = detectMediaIntent('zoom out');
  assert(zoomOut !== null && zoomOut.action === 'zoom_out', 'Should detect zoom out');
  console.log('  ✅ PASS: "zoom out" -> action: zoom_out');

  const zoomReset = detectMediaIntent('reset zoom');
  assert(zoomReset !== null && zoomReset.action === 'zoom_reset', 'Should detect reset zoom');
  console.log('  ✅ PASS: "reset zoom" -> action: zoom_reset');

  // --- 2. Tab & Window Switching ---
  console.log('\n--- TEST 2: Tab & Window Switching Shortcuts ---');
  const switchTab = detectMediaIntent('switch tab');
  assert(switchTab !== null && switchTab.action === 'switch_tab', 'Should detect switch tab');
  console.log('  ✅ PASS: "switch tab" -> action: switch_tab');

  const nextTab = detectMediaIntent('next tab please');
  assert(nextTab !== null && nextTab.action === 'switch_tab', 'Should detect next tab');
  console.log('  ✅ PASS: "next tab please" -> action: switch_tab');

  const prevTab = detectMediaIntent('previous tab');
  assert(prevTab !== null && prevTab.action === 'prev_tab', 'Should detect previous tab');
  console.log('  ✅ PASS: "previous tab" -> action: prev_tab');

  const switchApp = detectMediaIntent('switch window');
  assert(switchApp !== null && switchApp.action === 'switch_app', 'Should detect switch window');
  console.log('  ✅ PASS: "switch window" -> action: switch_app');

  // --- 3. Video Play & Pause Controls ---
  console.log('\n--- TEST 3: Media & Video Play/Pause Controls ---');
  const pauseVideo = detectMediaIntent('pause video');
  assert(pauseVideo !== null && pauseVideo.action === 'pause', 'Should detect pause video');
  console.log('  ✅ PASS: "pause video" -> action: pause');

  const playVideo = detectMediaIntent('play video');
  assert(playVideo !== null && playVideo.action === 'play', 'Should detect play video');
  console.log('  ✅ PASS: "play video" -> action: play');

  const resumeVideo = detectMediaIntent('resume video');
  assert(resumeVideo !== null && resumeVideo.action === 'play', 'Should detect resume video');
  console.log('  ✅ PASS: "resume video" -> action: play');

  // --- 4. VS Code Launching ---
  console.log('\n--- TEST 4: VS Code App Launching ---');
  const openVsCode = detectLocalOsIntent('open vs code');
  assert(openVsCode !== null && openVsCode.kind === 'open_app' && openVsCode.appName === 'code', 'Should detect open vs code');
  console.log('  ✅ PASS: "open vs code" -> open_app: code');

  const launchVsCode = detectLocalOsIntent('launch vscode');
  assert(launchVsCode !== null && launchVsCode.kind === 'open_app' && launchVsCode.appName === 'code', 'Should detect launch vscode');
  console.log('  ✅ PASS: "launch vscode" -> open_app: code');

  // --- 5. Screen Capture & Vision Intelligence Intent Detection ---
  console.log('\n--- TEST 5: Screen Vision & Screenshot Ingestion ---');
  const mockState: any = { settings: { aiConfig: { selectedProvider: 'groq', apiKeys: {} } } };

  // Fast route regex checks
  const mockWin: any = {
    electronAPI: {
      captureScreenshot: async () => 'data:image/png;base64,mockScreenshotBytes',
      desktopContext: {
        glance: async () => ({
          ok: true,
          foreground: { title: 'VS Code - FloatGPT', app: 'Code' },
          screenshot: 'data:image/png;base64,mockScreenshotBytes'
        })
      }
    }
  };
  (globalThis as any).window = mockWin;

  const screenshotRes = await tryFastRoute('take a screenshot', mockState);
  assert(screenshotRes.handled === true && screenshotRes.actionExecuted === 'capture_screenshot', 'Should fast route screenshot capture');
  console.log('  ✅ PASS: "take a screenshot" fast routed with 0 tokens');

  // --- 6. Wake Word Pattern Normalization ---
  console.log('\n--- TEST 6: Wake Word Pattern Variations ---');
  const wakeWords = [
    'hey float',
    'hey flow',
    'float',
    'flow',
    'float can you help me',
    'flow can you help me',
    'ok float',
    'hi float'
  ];

  const wakeRegex = /\b(hey\s+float|hey\s+flow|float\s+can\s+you\s+help\s+me|flow\s+can\s+you\s+help\s+me|ok\s+float|hi\s+float|hello\s+float|hey\s+flo|float|flow|flo)\b/i;

  for (const w of wakeWords) {
    assert(wakeRegex.test(w), `Wake word pattern should match: "${w}"`);
    console.log(`  ✅ PASS: Wake word recognized: "${w}"`);
  }

  // Verify embedded command stripping
  const embeddedUtterance = "Hey Float, zoom in";
  const match = embeddedUtterance.match(wakeRegex);
  assert(match !== null, 'Should match wake word in embedded utterance');
  const remainder = embeddedUtterance.slice(match.index! + match[0].length).replace(/^[,\s.-]+/, '');
  assert(remainder.toLowerCase() === 'zoom in', 'Should cleanly isolate command remainder');
  console.log(`  ✅ PASS: Isolated remainder "${remainder}" from "${embeddedUtterance}"`);

  // --- 7. Hands-Free Viewport Scrolling (PageDown / PageUp / Home / End) ---
  console.log('\n--- TEST 7: Viewport Scrolling & Page Navigation ---');
  const scrollDown = detectMediaIntent('scroll down');
  assert(scrollDown !== null && scrollDown.action === 'scroll_down', 'Should detect scroll down');
  console.log('  ✅ PASS: "scroll down" -> action: scroll_down');

  const pageDown = detectMediaIntent('page down');
  assert(pageDown !== null && pageDown.action === 'scroll_down', 'Should detect page down as scroll_down');
  console.log('  ✅ PASS: "page down" -> action: scroll_down');

  const scrollUp = detectMediaIntent('scroll up');
  assert(scrollUp !== null && scrollUp.action === 'scroll_up', 'Should detect scroll up');
  console.log('  ✅ PASS: "scroll up" -> action: scroll_up');

  const scrollTop = detectMediaIntent('scroll to top');
  assert(scrollTop !== null && scrollTop.action === 'scroll_top', 'Should detect scroll to top');
  console.log('  ✅ PASS: "scroll to top" -> action: scroll_top');

  const jumpTop = detectMediaIntent('jump to top');
  assert(jumpTop !== null && jumpTop.action === 'scroll_top', 'Should detect jump to top as scroll_top');
  console.log('  ✅ PASS: "jump to top" -> action: scroll_top');

  const scrollBottom = detectMediaIntent('scroll to bottom');
  assert(scrollBottom !== null && scrollBottom.action === 'scroll_bottom', 'Should detect scroll to bottom');
  console.log('  ✅ PASS: "scroll to bottom" -> action: scroll_bottom');

  const scrollEnd = detectMediaIntent('scroll to end');
  assert(scrollEnd !== null && scrollEnd.action === 'scroll_bottom', 'Should detect scroll to end as scroll_bottom');
  console.log('  ✅ PASS: "scroll to end" -> action: scroll_bottom');

  // --- 8. Universal In-App Find on Page ---
  console.log('\n--- TEST 8: Universal In-App Find on Page ---');
  const findQuery = detectMediaIntent('find error 404 on page');
  assert(findQuery !== null && findQuery.action === 'find_on_page' && findQuery.query === 'error 404', 'Should detect find error 404 on page');
  console.log('  ✅ PASS: "find error 404 on page" -> query: "error 404"');

  const searchDoc = detectMediaIntent('search for documentation on screen');
  assert(searchDoc !== null && searchDoc.action === 'find_on_page' && searchDoc.query === 'documentation', 'Should detect search for documentation');
  console.log('  ✅ PASS: "search for documentation on screen" -> query: "documentation"');

  const openFind = detectMediaIntent('open find');
  assert(openFind !== null && openFind.action === 'find_on_page', 'Should detect open find');
  console.log('  ✅ PASS: "open find" -> action: find_on_page');

  // --- 9. Fast Route Viewport & Search Execution ---
  console.log('\n--- TEST 9: Fast Routing for Viewport Navigation ---');
  let lastExecutedAction = '';
  let lastExecutedOpts: any = null;

  (mockWin.electronAPI as any).media = {
    control: async (action: string, opts: any) => {
      lastExecutedAction = action;
      lastExecutedOpts = opts;
      return { ok: true, action };
    }
  };

  const fastScrollRes = await tryFastRoute('scroll down', mockState);
  assert(fastScrollRes.handled === true && fastScrollRes.actionExecuted === 'media_scroll_down', 'Fast router should handle scroll down');
  assert(lastExecutedAction === 'scroll_down', 'Should invoke media.control with scroll_down');
  console.log('  ✅ PASS: Fast routed "scroll down" directly to OS viewport control (0 tokens)');

  const fastFindRes = await tryFastRoute('find pricing on page', mockState);
  assert(fastFindRes.handled === true && fastFindRes.actionExecuted === 'media_find_on_page', 'Fast router should handle find pricing on page');
  assert(asString(lastExecutedAction) === 'find_on_page' && lastExecutedOpts?.query === 'pricing', 'Should invoke find_on_page with query "pricing"');
  console.log('  ✅ PASS: Fast routed "find pricing on page" with clipboard injection (0 tokens)');

  // --- 10. AmbientWakeEngine Lifecycle & Transcript Dispatch ---
  console.log('\n--- TEST 10: AmbientWakeEngine Transcript Matching ---');
  const { AmbientWakeEngine } = await import('../lib/wakeEngine');
  let wakeTriggered = false;
  let commandDispatched = '';

  const testEngine = new AmbientWakeEngine({
    onWake: () => {
      wakeTriggered = true;
    },
    onCommand: (cmd) => {
      commandDispatched = cmd;
    }
  });

  // Simulate hearing "Hey Float, zoom in"
  testEngine.handleTranscriptStream("Hey Float, zoom in");
  assert(asBoolean(wakeTriggered) === true, 'Engine should trigger onWake');
  assert(commandDispatched === 'zoom in', 'Engine should extract and dispatch "zoom in"');
  console.log('  ✅ PASS: AmbientWakeEngine received "Hey Float, zoom in" -> dispatched "zoom in"');

  // Reset and test "Hey Flow, pause video"
  testEngine.notifyAssistantIdle();
  wakeTriggered = false;
  commandDispatched = '';
  testEngine.handleTranscriptStream("Hey Flow, pause video");
  assert(asBoolean(wakeTriggered) === true && commandDispatched === 'pause video', 'Engine should dispatch "pause video"');
  console.log('  ✅ PASS: AmbientWakeEngine received "Hey Flow, pause video" -> dispatched "pause video"');

  // --- 11. False-Positive Protection & Ambient Speech Rejection ---
  console.log('\n--- TEST 11: False-Positive Speech Rejection ---');
  testEngine.notifyAssistantIdle();
  wakeTriggered = false;
  commandDispatched = '';

  // 11a: Unrelated ambient speech
  testEngine.handleTranscriptStream("Can you pass me the water bottle please");
  assert(wakeTriggered === false, 'Should reject unrelated ambient speech');
  console.log('  ✅ PASS: Rejected unrelated conversation: "Can you pass me the water bottle"');

  // 11b: Conversational speech with "flow" in middle ("cash flow")
  testEngine.handleTranscriptStream("We need to review our quarterly cash flow statement");
  assert(wakeTriggered === false, 'Should reject conversational "cash flow"');
  console.log('  ✅ PASS: Rejected conversational "cash flow" in middle of sentence');

  // 11c: Conversational speech with "workflow"
  testEngine.handleTranscriptStream("I am currently setting up the GitHub Actions workflow");
  assert(wakeTriggered === false, 'Should reject "workflow"');
  console.log('  ✅ PASS: Rejected conversational "workflow"');

  // 11d: Conversational speech with "float" in middle
  testEngine.handleTranscriptStream("Do you think this wooden object will float in the lake");
  assert(wakeTriggered === false, 'Should reject "float" in middle of sentence');
  console.log('  ✅ PASS: Rejected conversational "will float in the lake"');

  // 11e: Valid direct invocation "Float, scroll down"
  testEngine.handleTranscriptStream("Float, scroll down");
  assert(asBoolean(wakeTriggered) === true && commandDispatched === 'scroll down', 'Should accept direct "Float, scroll down"');
  console.log('  ✅ PASS: Accepted direct invocation: "Float, scroll down"');

  // --- 12. Instant Stop, Exit, Done, Finish Dismissal Commands ---
  console.log('\n--- TEST 12: Stop, Exit, Done, Finish Dismissal ---');
  testEngine.notifyAssistantIdle();
  wakeTriggered = false;
  commandDispatched = '';

  // 12a: "stop"
  testEngine.handleTranscriptStream("stop");
  assert(commandDispatched === 'stop', 'Should immediately dispatch "stop"');
  console.log('  ✅ PASS: "stop" -> dispatched stop command');

  // 12b: "exit"
  commandDispatched = '';
  testEngine.handleTranscriptStream("exit");
  assert(commandDispatched === 'stop', 'Should immediately dispatch "stop" for exit');
  console.log('  ✅ PASS: "exit" -> dispatched stop command');

  // 12c: "done"
  commandDispatched = '';
  testEngine.handleTranscriptStream("done");
  assert(commandDispatched === 'stop', 'Should immediately dispatch "stop" for done');
  console.log('  ✅ PASS: "done" -> dispatched stop command');

  // 12d: "finish"
  commandDispatched = '';
  testEngine.handleTranscriptStream("finish");
  assert(commandDispatched === 'stop', 'Should immediately dispatch "stop" for finish');
  console.log('  ✅ PASS: "finish" -> dispatched stop command');

  // 12e: "Hey Float stop"
  commandDispatched = '';
  testEngine.handleTranscriptStream("Hey Float stop");
  assert(commandDispatched === 'stop', 'Should immediately dispatch "stop" for "Hey Float stop"');
  console.log('  ✅ PASS: "Hey Float stop" -> dispatched stop command');

  // 12f: FastRouter exit_and_stop handling
  const stopRouteRes = await tryFastRoute('stop', mockState);
  assert(stopRouteRes.handled === true && stopRouteRes.actionExecuted === 'exit_and_stop', 'Fast router should handle "stop"');
  console.log('  ✅ PASS: Fast routed "stop" to exit_and_stop (0 tokens)');

  const exitRouteRes = await tryFastRoute('exit', mockState);
  assert(exitRouteRes.handled === true && exitRouteRes.actionExecuted === 'exit_and_stop', 'Fast router should handle "exit"');
  console.log('  ✅ PASS: Fast routed "exit" to exit_and_stop (0 tokens)');

  // --- 13. Background Screen Understanding & Vision Fast Routing ---
  console.log('\n--- TEST 13: Background Screen Understanding Intent Detection ---');
  const bgUnderstandingQueries = [
    'understand the background',
    'understand background',
    'what is in the background',
    'what is happening in the background',
    'explain the background',
    'describe the background',
    'check background',
    'look at the background',
    'what do you see in the background',
    'what is on my screen',
    'what is running in the background'
  ];

  for (const q of bgUnderstandingQueries) {
    const res = await tryFastRoute(q, mockState);
    assert(res.handled === true && (res.actionExecuted === 'analyze_screen' || res.actionExecuted === 'analyze_screen_meta'), `Should handle background understanding for "${q}"`);
    console.log(`  ✅ PASS: Handled "${q}" -> ${res.actionExecuted}`);
  }

  // --- 14. YouTube Play & Pause Voice Commands ---
  console.log('\n--- TEST 14: YouTube Video Play/Pause & Media Controls ---');
  const pauseYt = detectMediaIntent('pause youtube');
  assert(pauseYt !== null && pauseYt.action === 'pause' && pauseYt.response.includes('YouTube'), 'Should detect "pause youtube" with YouTube response');
  console.log('  ✅ PASS: "pause youtube" -> action: pause (YouTube-aware)');

  const playYt = detectMediaIntent('play youtube');
  assert(playYt !== null && playYt.action === 'play' && playYt.response.includes('YouTube'), 'Should detect "play youtube" with YouTube response');
  console.log('  ✅ PASS: "play youtube" -> action: play (YouTube-aware)');

  const resumeYt = detectMediaIntent('resume youtube');
  assert(resumeYt !== null && resumeYt.action === 'play' && resumeYt.response.includes('YouTube'), 'Should detect "resume youtube" with YouTube response');
  console.log('  ✅ PASS: "resume youtube" -> action: play (YouTube-aware)');

  const toggleYt = detectMediaIntent('toggle youtube');
  assert(toggleYt !== null && toggleYt.action === 'toggle' && toggleYt.response.includes('YouTube'), 'Should detect "toggle youtube" with YouTube response');
  console.log('  ✅ PASS: "toggle youtube" -> action: toggle (YouTube-aware)');

  const pauseYtVid = detectMediaIntent('pause the youtube video');
  assert(pauseYtVid !== null && pauseYtVid.action === 'pause' && pauseYtVid.response.includes('YouTube'), 'Should detect "pause the youtube video"');
  console.log('  ✅ PASS: "pause the youtube video" -> action: pause (YouTube-aware)');

  const stopYtVid = detectMediaIntent('stop the video');
  assert(stopYtVid !== null && stopYtVid.action === 'pause', 'Should detect "stop the video" as media pause');
  console.log('  ✅ PASS: "stop the video" -> action: pause');

  console.log('\n================================================================');
  console.log('🎉 ALL VAD, SCREEN CAPTURE & OS SHORTCUT TESTS PASSED (100%)!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
