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
 * Filters messages by memory horizon and slices to context window.
 * Returns clean conversation turns ready for provider consumption.
 */
export function buildConversationContext(
  messages: Message[],
  memoryHorizonDays: number,
  contextWindow: number
): ConversationTurn[] {
  const memoryHorizonMs = (memoryHorizonDays || 7) * 24 * 60 * 60 * 1000;
  const horizonTimestamp = Date.now() - memoryHorizonMs;

  // Filter by memory horizon
  const relevantMessages = (messages || []).filter(m => m.timestamp >= horizonTimestamp);

  // Slice to context window and map to clean turns
  return relevantMessages.slice(-contextWindow).map(m => ({
    role: m.role,
    content: m.content,
    attachments: m.attachments
  }));
}
