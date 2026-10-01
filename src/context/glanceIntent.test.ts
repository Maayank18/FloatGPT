import { detectGlanceIntent, buildGlancePromptBlock, formatLocalFolderReply } from './glanceIntent';

function assert(cond: boolean, name: string) {
  if (!cond) throw new Error(name);
  console.log('  PASS', name);
}

{
  console.log('Glance intent');
  const which = detectGlanceIntent("could you tell me which screen i'm on right now");
  assert(which.wantsGlance && which.wantsVisual, 'which screen paraphrase');
  const asked = detectGlanceIntent('can you tell me on what screen i am on currently');
  assert(asked.wantsGlance && asked.wantsVisual, 'on what screen am I on');
  const screenQ = detectGlanceIntent('what is currently on my screen ?');
  assert(screenQ.wantsGlance && screenQ.wantsVisual, 'current screen question');
  const g = detectGlanceIntent('what can you see explain in one line the meaning');
  assert(g.wantsGlance && g.wantsVisual, 'visual glance for explain this screen');

  const d = detectGlanceIntent('hey what are things present in background');
  assert(d.wantsGlance && d.wantsFolder, 'folder/background glance');

  const x = detectGlanceIntent('please send Hi to Mummy');
  assert(!x.wantsGlance, 'does not steal WhatsApp send');

  const o = detectGlanceIntent('open chrome');
  assert(!o.wantsGlance, 'does not steal app launch');

  const s = detectGlanceIntent('setting kholdo');
  assert(!s.wantsGlance, 'does not steal settings launch');

  const f = detectGlanceIntent('create a file on desktop');
  assert(!f.wantsGlance, 'does not steal desktop file create');

  const folders = detectGlanceIntent('can you tell how many folders are present on desktop?');
  assert(!folders.wantsGlance, 'folder count stays a desktop count, not a screen look');

  const pauseScreen = detectGlanceIntent('my screen can you please pause it');
  assert(!pauseScreen.wantsGlance, 'pause the screen is media, not a glance');

  const block = buildGlancePromptBlock({
    foreground: { app: 'Google Chrome', title: 'Post on X', host: 'x.com' },
    hasScreenshot: true
  });
  assert(block.includes('[FLOATGPT_DESKTOP_GLANCE]') && block.includes('x.com'), 'prompt block cites site');

  const local = formatLocalFolderReply({
    foreground: { title: 'Desktop' },
    folder: { path: 'C:\\Users\\Me\\Desktop', items: ['Projects/', 'notes.txt'] }
  });
  assert(!!local && local.includes('notes.txt'), 'local folder listing');
  console.log('ok');
}
