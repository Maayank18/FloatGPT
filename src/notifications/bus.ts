type Listener = (event: SyncEvent) => void;

export type SyncEventType = 'SYNC_START' | 'SYNC_SUCCESS' | 'SYNC_ERROR' | 'REMOTE_UPDATE_RECEIVED' | 'NEW_JOURNAL_EVENT';

export interface SyncEvent {
  type: SyncEventType;
  payload?: any;
}

class NotificationBus {
  private listeners: Listener[] = [];

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  emit(event: SyncEvent) {
    this.listeners.forEach(l => l(event));
  }
}

export const syncBus = new NotificationBus();
