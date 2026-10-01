import { detectLocalOsIntent } from '../platform/osLaunch';
import { detectSystemDiagIntent } from '../platform/osDiagnostics';
import { detectMediaIntent } from '../platform/osMedia';
import { normalizeUtterance } from '../platform/naturalLanguage';

export type GlanceIntent = {
  wantsGlance: boolean;
  wantsVisual: boolean;
  wantsFolder: boolean;
};

/**
 * True when the user is asking about the live desktop / front window / screen,
 * not launching apps or sending messages.
 */
export function detectGlanceIntent(raw: string): GlanceIntent {
  const text = normalizeUtterance(raw);
  const lower = text;

  if (/\b(send|schedule)\b/i.test(lower) && /\bto\s+/i.test(lower)) {
    return { wantsGlance: false, wantsVisual: false, wantsFolder: false };
  }

  if (detectLocalOsIntent(text) || detectSystemDiagIntent(text) || detectMediaIntent(raw)) {
    return { wantsGlance: false, wantsVisual: false, wantsFolder: false };
  }

  const screenQuestion =
    /\b(screen|display|monitor)\b/.test(lower) &&
    /\b(what|which|where|current|currently|on|see|seeing|looking|show|tell|happening|behind|am)\b/.test(lower);
  const visual =
    screenQuestion ||
    /\b(what (do|can) you see|what'?s on (my |the )?(screen|display)|on (my |the )?screen|on what screen|what screen|which screen|this (post|tweet|page|tab|article|video)|explain (this|that)|meaning of (this|that)|what is this|glance|what am i (on|looking at|doing)|happening (in the |on the )?(background|screen))\b/i.test(
      lower
    ) || /\bexplain\b.+\b(one line|in (a )?line)\b/i.test(lower);

  const folder =
    /\b(folder|folders|files|desktop|explorer|finder|what'?s (in|on) (this|the|my) (folder|directory|desktop)|things present|what is present|what'?s here|what'?s behind)\b/i.test(
      lower
    );

  const background =
    /\b(background|behind me|in front|what'?s open|which (app|window|tab)|active window)\b/i.test(lower);

  const wantsGlance = visual || folder || background;
  return {
    wantsGlance,
    wantsVisual: visual || (background && !folder),
    wantsFolder: folder || /\bdesktop\b/i.test(lower) || /\bbackground\b/i.test(lower),
  };
}

export function buildGlancePromptBlock(packet: {
  foreground?: { app?: string; process?: string; title?: string; host?: string | null };
  openWindows?: string[];
  folder?: { path?: string; items?: string[] } | null;
  redacted?: boolean;
  lookedAtSelf?: boolean;
  hasScreenshot?: boolean;
}): string {
  const fg = packet.foreground || {};
  const windows = (packet.openWindows || []).filter(Boolean).slice(0, 8);
  const lines = [
    '[FLOATGPT_DESKTOP_GLANCE]',
    'This is a live reading of the user\'s screen behind the FloatGPT orb. You DO have this display. Never say you lack visibility or cannot see their screen.',
    `Front window: ${fg.app || fg.process || 'unknown'} — ${fg.title || '(none)'}`,
  ];
  if (windows.length) lines.push(`Other open windows: ${windows.join(' | ')}`);
  if (fg.host) lines.push(`Likely site: ${fg.host}`);
  if (packet.hasScreenshot) {
    lines.push('A screenshot of the real screen is attached. FloatGPT was excluded from the capture.');
    lines.push('Name the apps you see (for example Cursor, Chrome, YouTube) and describe the visible content: file, video, or page. The project name FloatGPT inside Cursor is the code they have open, not this assistant.');
  } else if (packet.lookedAtSelf) {
    lines.push('The foreground window was still FloatGPT and no screenshot was captured. Say you could not see the screen behind the orb.');
  } else if (fg.title || fg.app) {
    lines.push('Answer from these window titles. Do not say you cannot see the screen.');
  }
  if (packet.folder?.path) {
    const items = (packet.folder.items || []).slice(0, 40).join(', ');
    lines.push(`Open folder: ${packet.folder.path}`);
    lines.push(`Items: ${items || '(empty)'}`);
  }
  if (packet.redacted) {
    lines.push('Screenshot skipped: window title looked sensitive (password/bank/incognito).');
  }
  lines.push(
    'If a Cursor or VS Code window is listed first, that is the app the user is using, even when Edge or YouTube is also open. Mention the browser as also open. Do not say they are only in the browser.',
  );
  return lines.join('\n');
}

export function formatLocalFolderReply(packet: {
  foreground?: { app?: string; title?: string; host?: string | null };
  folder?: { path?: string; items?: string[] } | null;
}): string | null {
  if (!packet.folder?.path) return null;
  const items = packet.folder.items || [];
  const fg = packet.foreground?.title || packet.foreground?.app || 'File Explorer';
  const list = items.length
    ? items.map((n) => `- ${n}`).join('\n')
    : '_Empty folder_';
  return `*Looked at: ${fg}*\n\n**${packet.folder.path}**\n\n${list}`;
}
