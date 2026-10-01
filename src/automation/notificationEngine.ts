/**
 * FloatGPT — Automation Notification Engine
 * 
 * Emits and streams lifecycle notifications for scheduled and autonomous workflows.
 */

import { AutomationNotification } from './types';

type NotificationListener = (notification: AutomationNotification) => void;

export class NotificationEngine {
  private static notifications: AutomationNotification[] = [];
  private static listeners: Set<NotificationListener> = new Set();
  private static readonly MAX_NOTIFICATIONS = 100;

  static emit(params: Omit<AutomationNotification, 'id' | 'timestamp'>): AutomationNotification {
    const notification: AutomationNotification = {
      ...params,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now()
    };

    this.notifications.unshift(notification);
    if (this.notifications.length > this.MAX_NOTIFICATIONS) {
      this.notifications.pop();
    }

    for (const listener of this.listeners) {
      try {
        listener(notification);
      } catch (err) {
        console.error('[NotificationEngine] Listener error:', err);
      }
    }

    return notification;
  }

  static getRecent(limit: number = 20): AutomationNotification[] {
    return this.notifications.slice(0, limit);
  }

  static subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  static clear(): void {
    this.notifications = [];
  }
}
