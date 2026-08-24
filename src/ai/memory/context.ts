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

/**
 * Filters messages by memory horizon, slices to context window,
 * and strips heavy historical base64 attachments to preserve tokens.
 */
export function buildConversationContext(
  messages: Message[],
  memoryHorizonDays: number,
  contextWindow: number = 10
): ConversationTurn[] {
  const memoryHorizonMs = (memoryHorizonDays || 7) * 24 * 60 * 60 * 1000;
  const horizonTimestamp = Date.now() - memoryHorizonMs;

  // 1. Filter by memory horizon
  const relevantMessages = (messages || []).filter(m => m.timestamp >= horizonTimestamp);

  // 2. Slice to the most recent turns (default to 10 turns max to avoid token bloat)
  const effectiveWindow = Math.min(contextWindow || 10, 12);
  const sliced = relevantMessages.slice(-effectiveWindow);

  // 3. Map to clean turns, stripping heavy base64 data from older history turns
  return sliced.map((m, idx) => {
    const isLatestTurn = idx === sliced.length - 1;
    
    // Only pass raw image attachments on the most recent user turn.
    // For older historical turns, compress them to lightweight text markers.
    let compressedAttachments = undefined;
    if (m.attachments && m.attachments.length > 0) {
      if (isLatestTurn) {
        compressedAttachments = m.attachments;
      } else {
        compressedAttachments = undefined;
      }
    }

    // Clean up content: If older assistant message was a massive JSON string, clean it
    let cleanContent = m.content || '';
    if (m.role === 'assistant' && cleanContent.startsWith('{') && cleanContent.includes('"message"')) {
      const match = cleanContent.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (match && match[1]) {
        cleanContent = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    }

    return {
      role: m.role,
      content: cleanContent,
      attachments: compressedAttachments
    };
  });
}
