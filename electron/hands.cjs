const { shell } = require('electron');
const osActions = require('./osActionHandler.cjs');

const BROWSERS = ['chrome', 'msedge', 'firefox', 'brave'];
const MAIL = ['OUTLOOK', 'HxOutlook', 'olk'];

function clip(value, max) {
  return String(value || '').trim().slice(0, max);
}

function mailtoHref(job) {
  const to = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(job.toEmail || '') ? job.toEmail : '';
  const greeting = job.toName ? `Hi ${job.toName},\n\n` : '';
  const params = new URLSearchParams({
    subject: clip(job.subject, 120),
    body: clip(`${greeting}${job.body || ''}`, 1800),
  });
  return `mailto:${to}?${params.toString()}`;
}

async function focusListed(names) {
  const front = String(await osActions.foregroundProcessName() || '').toLowerCase();
  if (names.includes(front)) return { ok: true, name: front };
  for (const name of names) {
    const status = await osActions.focusRunningApp(name);
    if (status === 'focused') return { ok: true, name };
    if (status === 'failed') return { ok: false, reason: 'focus-failed' };
  }
  return { ok: false, reason: 'missing' };
}

async function openDraft(job) {
  const href = mailtoHref(job);
  await shell.openExternal(href);
  return { ok: true };
}

function formEntries(job) {
  const source = Array.isArray(job.fields) && job.fields.length
    ? job.fields
    : (job.label ? [{ label: job.label, value: job.value }] : []);
  return source
    .map((entry) => ({ label: clip(entry.label, 80), value: clip(entry.value, 500) }))
    .filter((entry) => entry.label && entry.value && !/password|passwd|secret|otp|\bpin\b/i.test(entry.label))
    .slice(0, 12);
}

async function fillField(job) {
  const entries = formEntries(job);
  if (!entries.length) return { ok: false, reason: 'missing' };
  const browser = await focusListed(BROWSERS);
  if (!browser.ok) return { ok: false, reason: browser.reason === 'focus-failed' ? 'focus-failed' : 'no-browser' };

  let previousClipboard = '';
  try {
    const { clipboard } = require('electron');
    previousClipboard = clipboard.readText();
  } catch {}

  const filled = [];
  const missed = [];
  try {
    for (const entry of entries) {
      const typed = await osActions.fillFocusedField(entry.label, entry.value, false);
      if (typed.ok) filled.push(entry.label);
      else missed.push(entry.label);
    }
  } finally {
    setTimeout(() => {
      try {
        const { clipboard } = require('electron');
        clipboard.writeText(previousClipboard || '');
      } catch {}
    }, 600);
  }

  if (!filled.length) return { ok: false, reason: 'failed', missed };
  return { ok: true, filled, missed };
}

async function editor(job) {
  const prompt = clip(job.prompt, 2000);
  if (!prompt) return { ok: false, reason: 'missing' };
  const pasted = await osActions.typeIntoCursorChat(prompt);
  if (!pasted.ok) {
    if (pasted.error === 'editor-closed') return { ok: false, reason: 'cursor-closed' };
    if (pasted.error === 'focus-failed') return { ok: false, reason: 'focus-failed' };
    return { ok: false, reason: 'failed' };
  }
  if (job.sendNow) {
    const pressed = await osActions.sendKeys('{ENTER}');
    if (!pressed.ok) return { ok: false, reason: 'failed' };
    return { ok: true, sent: true };
  }
  return { ok: true, sent: false };
}

async function confirm(job) {
  if (job.target === 'editor') {
    const cursor = await focusListed(['cursor']);
    if (!cursor.ok) return { ok: false, reason: cursor.reason === 'focus-failed' ? 'focus-failed' : 'cursor-closed' };
    const pressed = await osActions.sendKeys('{ENTER}');
    return pressed.ok ? { ok: true } : { ok: false, reason: 'failed' };
  }
  if (job.target === 'form') {
    const browser = await focusListed(BROWSERS);
    if (!browser.ok) return { ok: false, reason: browser.reason === 'focus-failed' ? 'focus-failed' : 'no-browser' };
    const pressed = await osActions.sendKeys('^{ENTER}');
    return pressed.ok ? { ok: true } : { ok: false, reason: 'failed' };
  }
  if (job.target === 'email') {
    const mail = await focusListed(MAIL.map((name) => name.toLowerCase()));
    if (!mail.ok) return { ok: false, reason: 'mail-not-front' };
    const pressed = await osActions.sendKeys('^{ENTER}');
    return pressed.ok ? { ok: true } : { ok: false, reason: 'failed' };
  }
  return { ok: false, reason: 'bad-job' };
}

async function paste(job) {
  const text = String(job.text || '').trim();
  if (!text) return { ok: false, reason: 'missing-text' };
  return await osActions.pasteIntoCodeEditor(text);
}

async function run(job) {
  if (!job || typeof job !== 'object') return { ok: false, reason: 'bad-job' };
  if (job.kind === 'email') return openDraft(job);
  if (job.kind === 'form') return fillField(job);
  if (job.kind === 'editor') return editor(job);
  if (job.kind === 'paste') return paste(job);
  if (job.kind === 'confirm') return confirm(job);
  return { ok: false, reason: 'bad-job' };
}

module.exports = { run, mailtoHref };
