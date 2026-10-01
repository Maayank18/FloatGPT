import { syncBus } from '../notifications/bus';
import { JournalEvent, MemorySummary, Message } from '../types';
import { useWorkspaceStore } from '../state/workspaceStore';

class SummarizerService {
  private lastSummarizedMessageCount: number = 0;
  private isSummarizing: boolean = false;

  constructor() {
    syncBus.subscribe((event: any) => {
      if (event.type === 'NEW_JOURNAL_EVENT') {
        this.processEvent(event.payload as JournalEvent);
      }
    });
  }

  private processEvent(event: JournalEvent) {
    if (event.type === 'task_completed') {
      const summary: MemorySummary = {
        id: Math.random().toString(36).substring(2, 9),
        topic: 'Task Execution',
        summary: `User completed task: ${event.payload?.title || 'Unknown task'}`,
        timestamp: Date.now(),
        source: event.source
      };
      useWorkspaceStore.getState().addSummary(summary);
    }

    if (event.type === 'plan_created') {
      const summary: MemorySummary = {
        id: Math.random().toString(36).substring(2, 9),
        topic: 'Planning',
        summary: `User created a new plan.`,
        timestamp: Date.now(),
        source: event.source
      };
      useWorkspaceStore.getState().addSummary(summary);
    }
  }

  /**
   * Lightweight deterministic memory recording.
   * Throttled to avoid spawning background LLM calls on every message.
   */
  async summarizeSession(state: any) {
    if (this.isSummarizing) return;
    
    const messages: Message[] = state.messages || [];
    if (messages.length === 0) return;

    // Only summarize if at least 6 new messages have accumulated since last extraction
    if (messages.length - this.lastSummarizedMessageCount < 6) return;

    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return;

    this.isSummarizing = true;
    try {
      const latestUserMsg = userMessages[userMessages.length - 1]?.content || '';
      
      // Clean deterministic topic extraction
      let topic = 'Conversation';
      if (latestUserMsg.length > 5) {
        const words = latestUserMsg.split(/\s+/).slice(0, 4).join(' ');
        topic = words.length > 30 ? words.slice(0, 30) + '...' : words;
      }

      const summary: MemorySummary = {
        id: Math.random().toString(36).substring(2, 9),
        topic: topic,
        summary: latestUserMsg.slice(0, 100),
        timestamp: Date.now(),
        source: 'orb'
      };

      useWorkspaceStore.getState().addSummary(summary);
      this.lastSummarizedMessageCount = messages.length;
    } catch (err) {
      console.warn('[Summarizer] Failed to record memory summary:', err);
    } finally {
      this.isSummarizing = false;
    }
  }
}

export const summarizer = new SummarizerService();
