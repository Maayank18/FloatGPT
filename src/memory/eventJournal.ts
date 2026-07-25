import { JournalEvent } from '../types';
import { syncBus } from '../notifications/bus';

class EventJournalService {
  private events: JournalEvent[] = [];

  recordEvent(type: JournalEvent['type'], source: JournalEvent['source'], payload: any) {
    const event: JournalEvent = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      source,
      payload,
      timestamp: Date.now()
    };
    this.events.push(event);
    
    // Notify summarizer or other systems
    syncBus.emit({ type: 'NEW_JOURNAL_EVENT', payload: event });
    
    // Keep journal bounded in memory
    if (this.events.length > 500) {
      this.events.shift();
    }
  }

  getRecentEvents(count: number = 50) {
    return this.events.slice(-count);
  }
}

export const eventJournal = new EventJournalService();
