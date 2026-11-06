import assert from 'node:assert';
import { diagnoseUserIssue } from '../pcDoctorService';

console.log('--- Testing PC Doctor Diagnostics Engine ---');

async function testPortDiagnostics() {
  const result = await diagnoseUserIssue('port 3000 is blocked');
  assert.strictEqual(result.category, 'port', 'Should detect port category');
  assert(result.headline.includes('Port 3000'), 'Headline must reference port 3000');
  assert(result.evidence.length > 0, 'Evidence must be present');
  assert(result.recommendedSteps.length > 0, 'Must provide recommended steps');
  console.log('✅ PASS: Port diagnostics intent test passed');
}

async function testPerformanceDiagnostics() {
  const result = await diagnoseUserIssue('my laptop fan is loud and freezing');
  assert.strictEqual(result.category, 'performance', 'Should detect performance category');
  assert(result.evidence.some((e) => e.includes('RAM') || e.includes('CPU')), 'Evidence must include hardware metrics');
  assert(result.recommendedSteps.length > 0, 'Must provide performance recommendations');
  console.log('✅ PASS: Performance lag diagnostics intent test passed');
}

async function testCrashDiagnostics() {
  const result = await diagnoseUserIssue('why did my app crash with error code 0xc0000005?');
  assert.strictEqual(result.category, 'crash', 'Should detect crash category');
  assert(result.recommendedSteps.length > 0, 'Must provide crash recovery steps');
  console.log('✅ PASS: Crash event diagnostics intent test passed');
}

async function testNetworkDiagnostics() {
  const result = await diagnoseUserIssue('wifi is slow and disconnected, flush dns');
  assert.strictEqual(result.category, 'network', 'Should detect network category');
  assert.strictEqual(result.actionType, 'flush_dns', 'Should offer flush_dns action');
  console.log('✅ PASS: Network and DNS flush diagnostics intent test passed');
}

async function testDiskDiagnostics() {
  const result = await diagnoseUserIssue('disk C: is out of space');
  assert.strictEqual(result.category, 'disk', 'Should detect disk category');
  assert(result.evidence.some((e) => e.includes('C:')), 'Evidence must include drive C:');
  console.log('✅ PASS: Storage diagnostics intent test passed');
}

async function testPredefinedOptions() {
  const whySlow = await diagnoseUserIssue('Why is PC slow?');
  assert.strictEqual(whySlow.category, 'performance');
  assert(whySlow.headline.includes('Cause') || whySlow.headline.includes('System Load'));
  console.log('✅ PASS: "Why is PC slow" bottleneck detector test passed');

  const memoryHog = await diagnoseUserIssue('Which app is taking most of the memory?');
  assert.strictEqual(memoryHog.category, 'performance');
  assert(memoryHog.headline.includes('Memory'));
  assert.strictEqual(memoryHog.actionType, 'open_taskmgr');
  console.log('✅ PASS: "Which app is taking most memory" test passed');

  const startupBloat = await diagnoseUserIssue('Unnecessary apps and startup bloat');
  assert.strictEqual(startupBloat.category, 'general');
  assert(startupBloat.headline.includes('Startup'));
  assert.strictEqual(startupBloat.actionType, 'open_startup_apps');
  console.log('✅ PASS: "Startup & Unnecessary apps" test passed');

  const howToResolve = await diagnoseUserIssue('How to resolve slowness?');
  assert.strictEqual(howToResolve.category, 'performance');
  assert(howToResolve.headline.includes('Speed Boost') || howToResolve.headline.includes('Recovery'));
  console.log('✅ PASS: "How to resolve slowness" test passed');
}

async function runAll() {
  await testPortDiagnostics();
  await testPerformanceDiagnostics();
  await testCrashDiagnostics();
  await testNetworkDiagnostics();
  await testDiskDiagnostics();
  await testPredefinedOptions();
  console.log('All PC Doctor tests completed successfully.');
}

runAll();

