import { syncBus } from '../notifications/bus';
import { JournalEvent, MemorySummary, Message } from '../types';
import { useWorkspaceStore } from '../state/workspaceStore';
import { generateAIResponse } from '../lib/ai';

class SummarizerService {
  private lastSummarizedMessageId: string | null = null;
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
   * Summarizes the recent chat history and adds it to the Workspace Memory Capsule.
   * This is called asynchronously after chat messages are added.
   */
  async summarizeSession(state: any) {
    if (this.isSummarizing) return;
    
    const messages: Message[] = state.messages || [];
    if (messages.length === 0) return;

    // Only summarize if there are new messages since last summary
    const lastMsg = messages[messages.length - 1];
    if (this.lastSummarizedMessageId === lastMsg.id) return;

    // Trigger summary to keep the shared Workspace Memory up-to-date for other surfaces
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return;

    this.isSummarizing = true;
    try {
      // Get the last 6 messages for context
      const recentContext = messages.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
      
      const prompt = `Based on the following recent conversation, create a very brief 1-sentence summary of the main topic the user is discussing or exploring. Output ONLY the summary sentence. Do not include any conversational filler.\n\n${recentContext}`;
      
      const summaryText = await generateAIResponse(state, prompt, undefined, false);

      // Create a short topic name
      const topicPrompt = `Based on this summary: "${summaryText.message}", provide a 1-3 word title for the topic. Output ONLY the topic title.`;
      const topicText = await generateAIResponse(state, topicPrompt, undefined, false);
      
      const summary: MemorySummary = {
        id: Math.random().toString(36).substring(2, 9),
        topic: topicText.message.replace(/["']/g, '').trim(),
        summary: summaryText.message.trim(),
        timestamp: Date.now(),
        source: 'orb'
      };
      
      useWorkspaceStore.getState().addSummary(summary);
      this.lastSummarizedMessageId = lastMsg.id;

    } catch (err) {
      console.error('[Summarizer] Failed to summarize session:', err);
    } finally {
      this.isSummarizing = false;
    }
  }
}

export const summarizer = new SummarizerService();

