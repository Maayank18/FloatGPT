import { detectLocalOsIntent, looksLikeOsDump } from './osLaunch';

function assert(cond: boolean, name: string) {
  if (!cond) throw new Error(name);
  console.log('  PASS', name);
}

{
  console.log('OS launch intent');
  const hinglish = detectLocalOsIntent('setting kholdo');
  assert(hinglish?.kind === 'open_app' && hinglish.appName === 'ms-settings:', 'setting kholdo');

  const typo = detectLocalOsIntent('opn settings please');
  assert(typo?.kind === 'open_app' && typo.appName === 'ms-settings:', 'opn settings');

  const uri = detectLocalOsIntent('start ms-settings:');
  assert(uri?.kind === 'open_app' && uri.appName.startsWith('ms-settings:'), 'start ms-settings:');

  const dump = looksLikeOsDump('start ms-settings:');
  assert(dump?.kind === 'open_app', 'dump start ms-settings');

  const polite = detectLocalOsIntent('could you please opn the settigns app for me');
  assert(polite?.kind === 'open_app' && polite.appName === 'ms-settings:', 'polite settings paraphrase');

  const want = detectLocalOsIntent('i want you to launch the calculator');
  assert(want?.kind === 'open_app' && want.appName === 'calc', 'i want you to launch calculator');
  const calc = detectLocalOsIntent('launch calculator');
  assert(calc?.kind === 'open_app' && calc.appName === 'calc', 'calculator maps to calc');

  const yt = detectLocalOsIntent('open youtube');
  assert(yt?.kind === 'open_url' && yt.url === 'https://youtube.com', 'youtube url');

  const file = detectLocalOsIntent('create a file on desktop named hello');
  assert(file?.kind === 'create_file' && file.folder === 'desktop' && file.name.includes('hello'), 'desktop file');

  const edge = detectLocalOsIntent('open the edge browser that is currently being opened');
  assert(edge?.kind === 'open_app' && edge.appName === 'msedge', 'existing edge phrase');

  const typed = detectLocalOsIntent('the current screen that i am on can you type hello how are you');
  assert(typed?.kind === 'type_text' && typed.text === 'hello how are you', 'type on current screen');

  assert(detectLocalOsIntent('Help me design a marketing strategy') === null, 'not a launch');
  assert(looksLikeOsDump('You can open settings from the Start menu.') === null, 'essay is not a dump');
  console.log('ok');
}
