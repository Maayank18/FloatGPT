/**
 * Deterministic OS launch / desktop-file actions.
 * Never send these to the LLM — the model prints `start ms-settings:` instead of running it.
 */

import { normalizeUtterance } from './naturalLanguage';

export type LocalOsIntent =
  | { kind: 'open_app'; appName: string; label: string }
  | { kind: 'open_url'; url: string; label: string; reuseOnly?: boolean }
  | { kind: 'create_file'; folder: 'desktop' | 'documents'; name: string; content: string }
  | { kind: 'type_text'; text: string; target: 'screen' | 'chat' }
  | { kind: 'editor_terminal' }
  | { kind: 'close_tab' }
  | { kind: 'close_then_open'; url: string; label: string };

const KNOWN_WEBSITES: Record<string, string> = {
  linkedin: 'https://linkedin.com',
  youtube: 'https://youtube.com',
  github: 'https://github.com',
  google: 'https://google.com',
  twitter: 'https://twitter.com',
  x: 'https://x.com',
  facebook: 'https://facebook.com',
  chatgpt: 'https://chatgpt.com',
  leetcode: 'https://leetcode.com',
  reddit: 'https://reddit.com',
  stackoverflow: 'https://stackoverflow.com',
  gmail: 'https://mail.google.com',
  instagram: 'https://instagram.com',
  whatsapp: 'https://web.whatsapp.com',
  'whatsapp web': 'https://web.whatsapp.com',
  'web whatsapp': 'https://web.whatsapp.com',
  'watsapp': 'https://web.whatsapp.com',
  'watsapp web': 'https://web.whatsapp.com',
  spotify: 'https://open.spotify.com',
  netflix: 'https://netflix.com',
  amazon: 'https://amazon.com',
};

const WIN_APPS: Record<string, string> = {
  chrome: 'chrome',
  'google chrome': 'chrome',
  edge: 'msedge',
  'microsoft edge': 'msedge',
  notepad: 'notepad',
  calculator: 'calc',
  calc: 'calc',
  terminal: 'wt',
  'windows terminal': 'wt',
  cmd: 'cmd',
  powershell: 'powershell',
  explorer: 'explorer',
  'file explorer': 'explorer',
  'task manager': 'taskmgr',
  'control panel': 'control',
  settings: 'ms-settings:',
  setting: 'ms-settings:',
  'system settings': 'ms-settings:',
  'windows settings': 'ms-settings:',
  'device settings': 'ms-settings:',
  'ms-settings': 'ms-settings:',
  'ms-settings:': 'ms-settings:',
  code: 'code',
  vscode: 'code',
  'vs code': 'code',
  spotify: 'spotify',
  discord: 'discord',
  slack: 'slack',
};

const MAC_APPS: Record<string, string> = {
  safari: 'Safari',
  chrome: 'Google Chrome',
  'google chrome': 'Google Chrome',
  notepad: 'TextEdit',
  calculator: 'Calculator',
  calc: 'Calculator',
  terminal: 'Terminal',
  finder: 'Finder',
  settings: 'System Settings',
  setting: 'System Settings',
  'system settings': 'System Settings',
  code: 'Visual Studio Code',
  vscode: 'Visual Studio Code',
  'vs code': 'Visual Studio Code',
  spotify: 'Spotify',
  discord: 'Discord',
  slack: 'Slack',
};

function stripFiller(raw: string): string {
  return normalizeUtterance(raw);
}

const VERB = String.raw`(?:open|opn|launch|start|run|kholo|kholdo|khol\s*do|khol\s*de|khol|chalu(?:\s*karo)?|on\s*karo)`;

function isMac(): boolean {
  if (typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent || '')) return true;
  return false;
}

function resolveApp(target: string): { appName: string; label: string } | null {
  const t = target.replace(/^["']|["']$/g, '').trim();
  if (!t) return null;

  const ms = t.match(/ms-settings:[^\s"']*/i);
  if (ms && /^(start-process|start(\s+-process)?|explorer(\.exe)?)\b/i.test(t)) {
    return { appName: ms[0], label: 'Windows Settings' };
  }

  if (/^ms-settings:/.test(t)) return { appName: t.split(/\s/)[0], label: 'Windows Settings' };

  const apps = isMac() ? MAC_APPS : WIN_APPS;
  if (apps[t]) return { appName: apps[t], label: t };

  const settingsish = t.replace(/^(the\s+)?(device\s+|laptop\s+|windows\s+|mac\s+|macos\s+|system\s+)?/, '');
  if (/^settings?$/.test(settingsish) || /^ms-settings:?$/.test(settingsish)) {
    return { appName: isMac() ? 'System Settings' : 'ms-settings:', label: 'Settings' };
  }

  return null;
}

/** Used only after an open/launch verb, so a sentence that merely mentions Edge is left alone. */
function resolveAppMention(target: string): { appName: string; label: string } | null {
  const exact = resolveApp(target);
  if (exact) return exact;
  const apps = isMac() ? MAC_APPS : WIN_APPS;
  const keys = Object.keys(apps).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (key.length < 3) continue;
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (re.test(target)) return { appName: apps[key], label: key };
  }
  return null;
}

function parseCreateFile(lower: string): LocalOsIntent | null {
  const wantsFile = /\b(file|txt|text file|notepad file)\b/.test(lower);
  const wantsCreate = /\b(create|creating|make|making|banao|bana\s*do|bana|likh\s*do|write|new)\b/.test(lower);
  const onDesktop = /\b(desktop|deskop|deskto)\b/.test(lower) || /\bdesktop\s*(pe|par|per)\b/.test(lower);
  const onDocs = /\bdocuments?\b/.test(lower);
  if (!wantsFile || !wantsCreate) return null;
  if (!onDesktop && !onDocs && !/\b(home|user folder)\b/.test(lower)) {
    if (!/\bon (the |my )?(desktop|documents)\b/.test(lower) && !/\b(desktop|documents)\s*(pe|par)/.test(lower)) {
      return null;
    }
  }

  let name = 'FloatGPT-note.txt';
  const named = lower.match(/\b(?:named|called|naam(?:\s+se)?|filename)\s+["']?([a-z0-9][a-z0-9._-]{0,79})["']?/i);
  if (named) {
    name = named[1].trim();
    if (!/\.[a-z0-9]{1,5}$/i.test(name)) name += '.txt';
  } else if (/\.txt\b/.test(lower)) {
    const m = lower.match(/\b([a-z0-9._-]{1,60}\.txt)\b/i);
    if (m) name = m[1];
  }

  let content = `Created by FloatGPT on ${new Date().toLocaleString()}\n`;
  const saying = lower.match(/\b(?:saying|with text|content|likh)\s+["']?(.{1,400}?)["']?\s*$/i);
  if (saying) content = saying[1].trim() + '\n';

  return {
    kind: 'create_file',
    folder: onDocs && !onDesktop ? 'documents' : 'desktop',
    name,
    content,
  };
}

function parseEditorTerminal(lower: string): LocalOsIntent | null {
  if (!/\b(?:side\s+)?terminal\b/.test(lower)) return null;
  if (!/\b(?:open|show|launch|pull)\b/.test(lower)) return null;
  return { kind: 'editor_terminal' };
}

function parseTypeText(lower: string): LocalOsIntent | null {
  if (!/\b(type|paste)\b/.test(lower)) return null;
  const chat = /\b(?:chat|chart|copilot|agent)(?:\s+(?:panel|box|window))?\b/.test(lower);
  if (!chat && /\b(file|email|message|whatsapp|script|code)\b/.test(lower)) return null;
  const m = lower.match(/\b(?:type|paste)\b(?:\s+(?:in|into|on)(?:\s+(?:the|this|my|current))?(?:\s+(?:screen|window|page|app))?)?\s+["']?(.{1,220}?)["']?$/);
  if (!m) return null;
  const text = m[1]
    .replace(/\b(?:in|into|on|to)\s+(?:(?:that|this|the|particular)\s+)*(?:chat|chart|copilot|agent)(?:\s+(?:panel|box|window))?\b/g, ' ')
    .replace(/\b(?:on|in|into)\s+(?:the\s+|this\s+|my\s+)?(?:current\s+)?(?:screen|window|page)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length < 2) return null;
  return { kind: 'type_text', text, target: chat ? 'chat' : 'screen' };
}

const SITE_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  github: 'GitHub',
  chatgpt: 'ChatGPT',
  leetcode: 'LeetCode',
  stackoverflow: 'Stack Overflow',
  gmail: 'Gmail',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  'whatsapp web': 'WhatsApp',
  'web whatsapp': 'WhatsApp',
  spotify: 'Spotify',
  netflix: 'Netflix',
};

function siteLabel(name: string): string {
  return SITE_LABELS[name] || name.charAt(0).toUpperCase() + name.slice(1);
}

function parseWikipedia(lower: string): LocalOsIntent | null {
  if (!/\b(wikipedia|wiki)\b/.test(lower)) return null;
  // "close the current wikipedia tab" is a close, not an article named Close.
  if (/^(close|band|bandkaro)\b/.test(lower)) return null;
  if (!/\b(open|launch|show|start|visit|kholo|kholdo|tab)\b/.test(lower) && !/\bon the web\b/.test(lower)) return null;
  const topic = lower
    .replace(/\b(open|launch|show|start|visit|kholo|kholdo|the|a|an|page|article|on|in|wikipedia|wiki|if|possible|i|was|am|asking|asked|ki|ke|please|for|me|my|just|can|you|to|that|this|it|web|browser|tab|currently|current|right|now|want|wanted|need)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const slug = topic
    ? topic.split(' ').filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('_')
    : 'Main_Page';
  const label = topic ? topic.split(' ').filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Wikipedia';
  return { kind: 'open_url', url: `https://en.wikipedia.org/wiki/${slug}`, label };
}

function wantsExistingTab(lower: string): boolean {
  return /\btabs?\b/.test(lower) && /\b(already|currently|current|existing)\b/.test(lower);
}

function parseOpenSite(lower: string): LocalOsIntent | null {
  const refusesMessage = /\bdo not want to message\b/.test(lower) || /\bjust open\b/.test(lower);
  if (/\b(send|message|text|dm|schedule)\b/.test(lower) && !refusesMessage) return null;
  const asks = /\b(open|switch|show|focus|launch|bring)\b/.test(lower) || /\bon the web\b/.test(lower) || /\btab\b/.test(lower);
  if (!asks) return null;
  const sites = Object.entries(KNOWN_WEBSITES).sort((a, b) => b[0].length - a[0].length);
  for (const [name, url] of sites) {
    if (name.length < 4) continue;
    const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (pattern.test(lower)) return { kind: 'open_url', url, label: siteLabel(name), reuseOnly: wantsExistingTab(lower) };
  }
  return null;
}

function parseCloseThenOpen(lower: string): LocalOsIntent | null {
  const match = lower.match(/^(close|band|bandkaro)\b.*?\band\b\s+(.+)$/);
  if (!match) return null;
  const opened = parseWikipedia(match[2]) || parseOpenSite(match[2]);
  if (!opened || opened.kind !== 'open_url') return null;
  return { kind: 'close_then_open', url: opened.url, label: opened.label };
}

function parseCloseTab(lower: string): LocalOsIntent | null {
  if (!/^(close|band|bandkaro)\b/.test(lower)) return null;
  if (/\b(floatgpt|orb|assistant)\b/.test(lower)) return null;
  if (!/\b(tab|tabs|page|wikipedia|wiki|browser)\b/.test(lower)) return null;
  return { kind: 'close_tab' };
}

/** True when the user is asking to launch/create locally — not to chat about it. */
export function detectLocalOsIntent(raw: string): LocalOsIntent | null {
  const lower = stripFiller(raw);
  if (!lower || lower.length > 280) return null;

  const swapped = parseCloseThenOpen(lower);
  if (swapped) return swapped;

  const closing = parseCloseTab(lower);
  if (closing) return closing;

  const wiki = parseWikipedia(lower);
  if (wiki) return wiki;

  const site = parseOpenSite(lower);
  if (site) return site;

  const created = parseCreateFile(lower);
  if (created) return created;

  const typed = parseTypeText(lower);
  if (typed) return typed;

  const terminal = parseEditorTerminal(lower);
  if (terminal) return terminal;

  const dump = lower
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  if (/^(start-process|start(\s+-process)?|explorer(\.exe)?)\s+["']?ms-settings:/i.test(dump) || dump === 'ms-settings:' || dump === 'start ms-settings:') {
    return { kind: 'open_app', appName: 'ms-settings:', label: 'Windows Settings' };
  }

  const settingsVerbLast = lower.match(new RegExp(`^(?:the\\s+)?(?:windows\\s+|system\\s+|device\\s+)?settings?\\s+${VERB}$`));
  if (settingsVerbLast) {
    return { kind: 'open_app', appName: isMac() ? 'System Settings' : 'ms-settings:', label: 'Settings' };
  }

  const settingsOnly = /^(the\s+)?(windows\s+|system\s+|device\s+)?settings?$/.test(lower);
  if (settingsOnly) {
    return { kind: 'open_app', appName: isMac() ? 'System Settings' : 'ms-settings:', label: 'Settings' };
  }

  const verbFirst = lower.match(new RegExp(`^${VERB}\\s+(.+)$`));
  if (verbFirst) {
    let target = verbFirst[1]
      .replace(/^(up|the|my|a|an)\s+/g, '')
      .replace(/\b(the|my|for me|app|application)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    target = target.replace(/\s+(please|thanks|thank you)$/g, '').trim();

    const site = KNOWN_WEBSITES[target] || KNOWN_WEBSITES[target.replace(/\s+/g, '')];
    if (site) return { kind: 'open_url', url: site, label: target };

    if (/^https?:\/\//i.test(target) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\.(com|org|net|io|dev|ai|edu|gov|co|app|xyz)(\/.*)?$/i.test(target)) {
      const url = target.startsWith('http') ? target : `https://${target}`;
      return { kind: 'open_url', url, label: target };
    }

    const app = resolveAppMention(target);
    if (app) return { kind: 'open_app', ...app };
  }

  const go = lower.match(/^(go to|visit|navigate to)\s+(.+)$/);
  if (go) {
    const target = go[2].trim();
    const site = KNOWN_WEBSITES[target] || KNOWN_WEBSITES[target.replace(/\s+/g, '')];
    if (site) return { kind: 'open_url', url: site, label: target };
  }

  // Direct entity invocation without leading verb (e.g. "WhatsApp Web", "YouTube", "Calculator")
  const directTarget = lower.replace(/[.,!]+$/, '').trim();
  const directSite = KNOWN_WEBSITES[directTarget] || KNOWN_WEBSITES[directTarget.replace(/\s+/g, '')];
  if (directSite) {
    return { kind: 'open_url', url: directSite, label: directTarget };
  }
  const directApp = resolveApp(directTarget);
  if (directApp) {
    return { kind: 'open_app', ...directApp };
  }

  return null;
}

export function looksLikeOsDump(text: string): LocalOsIntent | null {
  const t = String(text || '')
    .trim()
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  if (!t || t.length > 120 || t.includes('\n\n')) return null;
  return detectLocalOsIntent(t);
}

export async function executeLocalOsIntent(intent: LocalOsIntent): Promise<{ ok: boolean; message: string; data?: Record<string, unknown> }> {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;

  if (intent.kind === 'close_tab' || intent.kind === 'close_then_open') {
    const control = api?.media?.control;
    let closed = false;
    if (control) {
      const res = await control('close_tab');
      closed = !!res?.ok;
    }
    if (intent.kind === 'close_tab') {
      return closed
        ? { ok: true, message: 'Closed the current tab.' }
        : { ok: false, message: 'I could not close the current tab. I left it alone.' };
    }
    if (api?.flow?.openUrl) await api.flow.openUrl(intent.url);
    else if (api?.openExternal) await api.openExternal(intent.url);
    else if (typeof window !== 'undefined') window.open(intent.url, '_blank');
    return {
      ok: true,
      message: closed
        ? `Closed the current tab. **${intent.label}** is in front.`
        : `I could not close the tab. **${intent.label}** is in front.`,
      data: { url: intent.url },
    };
  }

  if (intent.kind === 'open_url') {
    let opened = true;
    if (api?.flow?.openUrl) opened = !!(await api.flow.openUrl(intent.url, { reuseOnly: !!intent.reuseOnly }));
    else if (api?.openExternal) await api.openExternal(intent.url);
    else if (typeof window !== 'undefined') window.open(intent.url, '_blank');
    if (intent.reuseOnly && !opened) {
      return { ok: false, message: `I could not find an open **${intent.label}** tab. I did not open a new one.` };
    }
    return {
      ok: true,
      message: `**${intent.label}** is in front.`,
      data: { url: intent.url },
    };
  }

  if (intent.kind === 'open_app') {
    let ok = true;
    if (api?.flow?.openApp) ok = !!(await api.flow.openApp(intent.appName));
    const ran = !!api?.flow?.openApp;
    return {
      ok: ran ? ok : true,
      message: ran && !ok
        ? `Could not open **${intent.label}**. Fully restart the FloatGPT desktop app and try again.`
        : `**${intent.label}** is in front.`,
      data: { appName: intent.appName },
    };
  }

  if (intent.kind === 'editor_terminal') {
    const openTerminal = api?.flow?.editorTerminal;
    if (!openTerminal) {
      return { ok: false, message: 'The editor terminal needs a full restart of the FloatGPT desktop app.' };
    }
    const res = await openTerminal();
    if (!res?.ok) return { ok: false, message: 'The editor is not open. I left that alone.' };
    return { ok: true, message: 'I pressed the terminal shortcut in the editor. If it was already open, that closes it.' };
  }

  if (intent.kind === 'type_text') {
    const typeText = api?.flow?.typeText;
    if (!typeText) {
      return { ok: false, message: 'Typing into the screen needs a full restart of the FloatGPT desktop app.' };
    }
    const res = await typeText(intent.text, intent.target);
    if (intent.target === 'chat') {
      if (res?.error === 'editor-closed') return { ok: false, message: 'The editor is not open. I left that alone.' };
      if (!res?.ok) return { ok: false, message: 'I could not reach the chat box. I left the file alone.' };
      return { ok: true, message: `Pasted “${intent.text}” into the editor chat. Enter is not pressed. If it landed in the file, click the chat box once and say it again.` };
    }
    return {
      ok: !!res?.ok,
      message: res?.ok
        ? `Typed “${intent.text}” into the window behind FloatGPT.`
        : 'The window behind FloatGPT did not take the keystrokes. Click that window once, then ask again.',
    };
  }

  const write = api?.flow?.writeUserFile;
  if (!write) {
    return { ok: false, message: '⚠️ File create needs the **FloatGPT desktop app** (fully restart after this update).' };
  }
  const res = await write({ folder: intent.folder, name: intent.name, content: intent.content, openAfter: true });
  if (!res?.ok) {
    return { ok: false, message: `Could not create the file: ${res?.error || 'unknown error'}` };
  }
  return {
    ok: true,
    message: `📄 Created **${res.path}** on your ${intent.folder}.`,
    data: { path: res.path },
  };
}
