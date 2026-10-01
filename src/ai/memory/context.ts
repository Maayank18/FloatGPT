/**
 * Memory Context Builder
 * Handles memory horizon filtering and conversation history slicing.
 * Keeps context assembly separate from provider calling.
 */

import type { ConversationTurn } from '../providers/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachments?: any[];
}

const MAX_OLDER_CHARS = 1600;
const MAX_LATEST_CHARS = 4000;
const MAX_MEMORY_LINE = 280;

/** Strip payloads that burn tokens without helping the next answer. */
export function compactTurnContent(content: string, isLatest: boolean): string {
  let t = String(content || '');
  t = t.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/g, '[image]');
  t = t.replace(/https:\/\/image\.pollinations\.ai\/prompt\/[^\s)]+/g, '[image]');
  t = t.replace(/<!--[\s\S]*?-->/g, '');
  if (/Scan WhatsApp QR|WHATSAPP_QR_REQUIRED/i.test(t)) {
    t = '[WhatsApp: QR scan required]';
  }
  const max = isLatest ? MAX_LATEST_CHARS : MAX_OLDER_CHARS;
  if (t.length > max) return `${t.slice(0, max)}…`;
  return t;
}

/**
 * Filters messages by memory horizon, slices to context window,
 * and strips heavy historical base64 attachments to preserve tokens.
 */
export function buildConversationContext(
  messages: Message[],
  memoryHorizonDays: number,
  contextWindow: number = 10
): ConversationTurn[] {
  if (contextWindow <= 0) return [];

  const memoryHorizonMs = (memoryHorizonDays || 7) * 24 * 60 * 60 * 1000;
  const horizonTimestamp = Date.now() - memoryHorizonMs;

  const relevantMessages = (messages || []).filter(m => m.timestamp >= horizonTimestamp);

  const effectiveWindow = Math.min(Math.max(contextWindow || 0, 0), 24);
  const sliced = relevantMessages.slice(-effectiveWindow);
  const older = relevantMessages.slice(0, Math.max(0, relevantMessages.length - sliced.length));

  const memoryNote = older.slice(-30).map((m) => {
    const line = compactTurnContent(m.content || '', false).replace(/\s+/g, ' ').trim();
    const short = line.length > MAX_MEMORY_LINE ? `${line.slice(0, MAX_MEMORY_LINE)}…` : line;
    return `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${short}`;
  }).join('\n');

  const turns = sliced.map((m, idx) => {
    const isLatestTurn = idx === sliced.length - 1;
    let cleanContent = compactTurnContent(m.content || '', isLatestTurn);

    if (m.role === 'assistant' && cleanContent.startsWith('{') && cleanContent.includes('"message"')) {
      const match = cleanContent.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (match && match[1]) {
        cleanContent = compactTurnContent(
          match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
          isLatestTurn
        );
      }
    }

    return {
      role: m.role,
      content: cleanContent,
      attachments: isLatestTurn && m.attachments?.length ? m.attachments : undefined
    };
  });

  if (!memoryNote) return turns;
  const preface = `Earlier in this same chat:\n${memoryNote}`;
  if (turns.length > 0 && turns[0].role === 'user') {
    turns[0] = { ...turns[0], content: `${preface}\n\nContinuing:\n${turns[0].content}` };
    return turns;
  }
  return [{ role: 'user', content: preface }, ...turns];
}
