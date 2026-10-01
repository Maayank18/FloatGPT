/**
 * Deterministic OS launch / desktop-file actions.
 * Never send these to the LLM — the model prints `start ms-settings:` instead of running it.
 */

import { normalizeUtterance } from './naturalLanguage';

export type LocalOsIntent =
  | { kind: 'open_app'; appName: string; label: string }
  | { kind: 'open_url'; url: string; label: string }
  | { kind: 'create_file'; folder: 'desktop' | 'documents'; name: string; content: string }
  | { kind: 'type_text'; text: string };

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

function parseTypeText(lower: string): LocalOsIntent | null {
  if (!/\b(type|paste)\b/.test(lower)) return null;
  if (/\b(file|email|message|whatsapp|script|code)\b/.test(lower)) return null;
  const m = lower.match(/\b(?:type|paste)\b(?:\s+(?:in|into|on)(?:\s+(?:the|this|my|current))?(?:\s+(?:screen|window|page|app))?)?\s+["']?(.{1,180}?)["']?$/);
  if (!m) return null;
  const text = m[1]
    .replace(/\b(on|in|into)\s+(the\s+|this\s+|my\s+)?(current\s+)?(screen|window|page)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length < 2) return null;
  return { kind: 'type_text', text };
}

/** True when the user is asking to launch/create locally — not to chat about it. */
export function detectLocalOsIntent(raw: string): LocalOsIntent | null {
  const lower = stripFiller(raw);
  if (!lower || lower.length > 280) return null;

  const created = parseCreateFile(lower);
  if (created) return created;

  const typed = parseTypeText(lower);
  if (typed) return typed;

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

  if (intent.kind === 'open_url') {
    if (api?.flow?.openUrl) await api.flow.openUrl(intent.url);
    else if (api?.openExternal) await api.openExternal(intent.url);
    else if (typeof window !== 'undefined') window.open(intent.url, '_blank');
    return {
      ok: true,
      message: `🌐 Opening **${intent.label}**…`,
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

  if (intent.kind === 'type_text') {
    const typeText = api?.flow?.typeText;
    if (!typeText) {
      return { ok: false, message: 'Typing into the screen needs a full restart of the FloatGPT desktop app.' };
    }
    const res = await typeText(intent.text);
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
