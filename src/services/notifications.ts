import { useAppStore } from '../lib/store';
import { AppNotification } from '../types';

export const NotificationBus = {
  /**
   * Pushes a new notification to the unified state bus.
   * This immediately syncs to both Playground and Desktop Orb.
   */
  notify(
    title: string, 
    message: string, 
    type: 'info' | 'success' | 'warning' | 'error' = 'info', 
    actionUrl?: string
  ) {
    const store = useAppStore.getState();
    const newAlert: AppNotification = {
      id: store.generateId(),
      title,
      message,
      type,
      isRead: false,
      createdAt: Date.now(),
      actionUrl
    };

    store.setState((prev) => ({
      ...prev,
      notifications: [newAlert, ...(prev.notifications || [])].slice(0, 50) // Keep last 50
    }));
  },

  /**
   * Marks a notification as read, syncing the read state across surfaces.
   */
  markAsRead(id: string) {
    const store = useAppStore.getState();
    store.setState((prev) => ({
      ...prev,
      notifications: (prev.notifications || []).map(n => 
        n.id === id ? { ...n, isRead: true } : n
      )
    }));
  },

  /**
   * Clears all notifications.
   */
  clearAll() {
    const store = useAppStore.getState();
    store.setState((prev) => ({ ...prev, notifications: [] }));
  }
};
