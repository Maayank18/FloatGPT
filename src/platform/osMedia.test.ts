import { detectMediaIntent } from './osMedia';

function assert(cond: boolean, name: string) {
  if (!cond) throw new Error(`Assertion failed: ${name}`);
  console.log('  PASS:', name);
}

{
  console.log('OS Media Intent Detection Test Suite');

  // Pause
  const p1 = detectMediaIntent('pause the video');
  assert(p1?.action === 'pause', 'pause the video');

  const p2 = detectMediaIntent('pause video');
  assert(p2?.action === 'pause', 'pause video');

  const p3 = detectMediaIntent('please pause music');
  assert(p3?.action === 'pause', 'please pause music');

  const screenPause = detectMediaIntent('my screen can you please pause it');
  assert(screenPause?.action === 'pause', 'pause it on my screen');

  const pauseIt = detectMediaIntent('pause it');
  assert(pauseIt?.action === 'pause', 'pause it');

  assert(detectMediaIntent('pause this marketing campaign') === null, 'pause a campaign is not media');

  // Play / Resume
  const r1 = detectMediaIntent('play video');
  assert(r1?.action === 'play', 'play video');

  const r2 = detectMediaIntent('resume video');
  assert(r2?.action === 'play', 'resume video');

  const r3 = detectMediaIntent('resume');
  assert(r3?.action === 'play', 'resume');

  const r4 = detectMediaIntent('play music');
  assert(r4?.action === 'play', 'play music');

  // Volume & Mute
  const m1 = detectMediaIntent('mute audio');
  assert(m1?.action === 'mute', 'mute audio');

  const m2 = detectMediaIntent('unmute');
  assert(m2?.action === 'mute', 'unmute');

  const v1 = detectMediaIntent('volume up');
  assert(v1?.action === 'volume_up', 'volume up');

  const v2 = detectMediaIntent('turn it down');
  assert(v2?.action === 'volume_down', 'turn it down');

  // Track navigation
  const t1 = detectMediaIntent('next song');
  assert(t1?.action === 'next', 'next song');

  const t2 = detectMediaIntent('previous track');
  assert(t2?.action === 'prev', 'previous track');

  // Non-media queries should return null
  assert(detectMediaIntent('what is my battery level') === null, 'not media: battery');
  assert(detectMediaIntent('how many folders are on desktop') === null, 'not media: folders');
  assert(detectMediaIntent('help me write code') === null, 'not media: code');

  console.log('ALL OS MEDIA INTENT TESTS PASSED! ✅');
}
