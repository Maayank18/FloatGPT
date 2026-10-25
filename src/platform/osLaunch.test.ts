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

  const linkedinTab = detectLocalOsIntent('Open the LinkedIn tab that is open in the current session instead of opening a new tab.');
  assert(linkedinTab?.kind === 'open_url' && linkedinTab.url === 'https://linkedin.com' && linkedinTab.reuseOnly === true, 'open the linkedin tab already in this session');
  const leadTab = detectLocalOsIntent('Please open the lead code tab that is currently open.');
  assert(leadTab?.kind === 'open_url' && leadTab.url === 'https://leetcode.com' && leadTab.reuseOnly === true, 'existing leetcode tab is switched, not opened again');

  const justOpen = detectLocalOsIntent("I don't want to message someone on LinkedIn. Just open LinkedIn for me.");
  assert(justOpen?.kind === 'open_url' && justOpen.url === 'https://linkedin.com', 'just open linkedin, do not message');

  const wiki = detectLocalOsIntent('Can you please open Wispr Flow Wikipedia if possible?');
  assert(wiki?.kind === 'open_url' && wiki.url === 'https://en.wikipedia.org/wiki/Wispr_Flow', 'open wispr flow wikipedia');
  const wikiHome = detectLocalOsIntent('I was asking ki please open Wikipedia for me on the web.');
  assert(wikiHome?.kind === 'open_url' && wikiHome.url === 'https://en.wikipedia.org/wiki/Main_Page' && wikiHome.label === 'Wikipedia', 'open wikipedia itself');
  const closeCurrent = detectLocalOsIntent('close the current wikipedia tab please');
  assert(closeCurrent?.kind === 'close_tab', 'close the current wikipedia tab does not open an article named Close');
  const closeThis = detectLocalOsIntent('close this tab');
  assert(closeThis?.kind === 'close_tab', 'close this tab');
  const closeThenOpen = detectLocalOsIntent('close shah rukh khan wikipedia and open salman khan wikipedia please');
  assert(
    closeThenOpen?.kind === 'close_then_open' && closeThenOpen.url === 'https://en.wikipedia.org/wiki/Salman_Khan' && closeThenOpen.label === 'Salman Khan',
    'close one wikipedia tab and open another'
  );

  const onWeb = detectLocalOsIntent('LinkedIn on the web please.');
  assert(onWeb?.kind === 'open_url' && onWeb.url === 'https://linkedin.com', 'linkedin on the web');

  assert(detectLocalOsIntent('please send Hi to Mummy on Whatsapp') === null, 'a real message is not a site launch');

  const file = detectLocalOsIntent('create a file on desktop named hello');
  assert(file?.kind === 'create_file' && file.folder === 'desktop' && file.name.includes('hello'), 'desktop file');

  const edge = detectLocalOsIntent('open the edge browser that is currently being opened');
  assert(edge?.kind === 'open_app' && edge.appName === 'msedge', 'existing edge phrase');

  const typed = detectLocalOsIntent('the current screen that i am on can you type hello how are you');
  assert(typed?.kind === 'type_text' && typed.text === 'hello how are you' && typed.target === 'screen', 'type on current screen');

  const chat = detectLocalOsIntent('being open can you type can you explain the project in that particular chart panel');
  assert(chat?.kind === 'type_text' && chat.target === 'chat' && chat.text === 'can you explain the project', 'type into the chat panel');

  const terminal = detectLocalOsIntent('vs code for me and open the side terminal');
  assert(terminal?.kind === 'editor_terminal', 'open the editor terminal');

  assert(detectLocalOsIntent('Help me design a marketing strategy') === null, 'not a launch');
  assert(looksLikeOsDump('You can open settings from the Start menu.') === null, 'essay is not a dump');
  console.log('ok');
}
