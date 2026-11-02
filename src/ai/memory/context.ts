/**
 * Memory Context Builder
 * Keeps the latest 50 messages of the active chat (25 from the user, 25 replies).
 * Older messages stay on screen and are not sent to the model.
 */

import type { ConversationTurn } from '../providers/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachments?: any[];
}

const MAX_OLDER_CHARS = 2500;
const MAX_LATEST_CHARS = 6000;

/** 25 user messages + 25 replies. The live question is sent separately, so history keeps 49. */
export const CHAT_CONTEXT_LIMIT = 50;

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
 * Keeps the recent turns of this chat and drops anything older.
 * The window is the messages themselves. Older turns are not summarized back in.
 */
export function buildConversationContext(
  messages: Message[],
  _memoryHorizonDays: number,
  contextWindow: number = CHAT_CONTEXT_LIMIT - 1
): ConversationTurn[] {
  if (contextWindow <= 0) return [];

  const relevantMessages = messages || [];
  const effectiveWindow = Math.min(Math.max(contextWindow || 0, 0), CHAT_CONTEXT_LIMIT);
  const sliced = relevantMessages.slice(-effectiveWindow);

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

  return turns;
}
