import assert from 'assert';
import { resolveAlias } from '../agent/aliasResolver';
import { detectLocalOsIntent } from '../platform/osLaunch';
import { tryFastRoute } from '../ai/fastRouter';

async function runTests() {
  console.log('🧪 Testing WhatsApp Entity Normalization & Launch Routing...');

  // Test 1: Alias normalization
  const alias1 = resolveAlias('WatsApp, Web.');
  console.log('resolveAlias("WatsApp, Web.") ->', alias1);
  assert(alias1.toLowerCase().includes('whatsapp web'), 'Should normalize "WatsApp, Web." to "whatsapp web"');

  const alias2 = resolveAlias('open watsapp');
  console.log('resolveAlias("open watsapp") ->', alias2);
  assert(alias2.toLowerCase().includes('whatsapp'), 'Should normalize "watsapp" to "whatsapp"');

  // Test 2: Local OS Intent detection
  const intent1 = detectLocalOsIntent('WatsApp, Web.');
  console.log('detectLocalOsIntent("WatsApp, Web.") ->', intent1);
  assert(intent1 !== null, 'Should detect local intent for "WatsApp, Web."');
  assert(intent1?.kind === 'open_url', 'Should be open_url kind');
  assert((intent1 as any).url === 'https://web.whatsapp.com', 'Should point to https://web.whatsapp.com');

  const intent2 = detectLocalOsIntent('whatsapp web');
  console.log('detectLocalOsIntent("whatsapp web") ->', intent2);
  assert(intent2 !== null && intent2.kind === 'open_url' && (intent2 as any).url === 'https://web.whatsapp.com');

  const intent3 = detectLocalOsIntent('open whatsapp');
  console.log('detectLocalOsIntent("open whatsapp") ->', intent3);
  assert(intent3 !== null && intent3.kind === 'open_url' && (intent3 as any).url === 'https://web.whatsapp.com');

  // Test 3: Fast Router
  const dummyState: any = { settings: { aiConfig: {} } };
  const fast1 = await tryFastRoute('WatsApp, Web.', dummyState);
  console.log('tryFastRoute("WatsApp, Web.") ->', fast1);
  assert(fast1.handled === true, 'FastRoute should handle "WatsApp, Web."');
  assert(fast1.data?.url === 'https://web.whatsapp.com', 'FastRoute URL should be web.whatsapp.com');

  const fast2 = await tryFastRoute('WhatsApp Web', dummyState);
  console.log('tryFastRoute("WhatsApp Web") ->', fast2);
  assert(fast2.handled === true, 'FastRoute should handle "WhatsApp Web"');

  console.log('✅ ALL WHATSAPP LAUNCH TESTS PASSED!');
}

runTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
