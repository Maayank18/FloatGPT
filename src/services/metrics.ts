import { useAppStore } from '../lib/store';
import { AppState, MetricsState } from '../types';

export const MetricsService = {
  /**
   * Evaluates current execution momentum and updates the metrics state.
   * "Momentum" is a simplified score based on completion velocity and query volume.
   */
  calculatePulse(state: AppState): MetricsState {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    
    // Calculate Today's Activity
    let completedTasksToday = 0;
    let createdTasksToday = 0;

    (state.tasks || []).forEach(task => {
      if (task.createdAt >= todayStart) createdTasksToday++;
      if (task.completedAt && task.completedAt >= todayStart) completedTasksToday++;
    });

    (state.history || []).forEach(h => {
      if (h.completedAt >= todayStart) completedTasksToday++;
    });

    const queriesToday = (state.messages || []).filter(
      m => m.role === 'user' && m.timestamp >= todayStart
    ).length;

    // Derived Momentum Score (0-100)
    let momentum = 50; // Base baseline
    
    // + for completing tasks
    momentum += completedTasksToday * 10;
    
    // - for creating massive backlogs without closing them
    if (createdTasksToday > completedTasksToday * 2) {
      momentum -= (createdTasksToday - completedTasksToday) * 2;
    }
    
    // + for active engagement with AI
    if (queriesToday > 0) momentum += 5;
    if (queriesToday > 10) momentum += 5;

    // Cap
    momentum = Math.max(10, Math.min(100, momentum));

    return {
      queriesToday,
      completedTasksToday,
      createdTasksToday,
      momentumScore: Math.round(momentum),
      lastCalculatedAt: Date.now()
    };
  },

  /**
   * Refreshes the metrics state in the global store.
   * Safe to call on intervals or after major state changes.
   */
  refreshMetrics() {
    const store = useAppStore.getState();
    const newMetrics = this.calculatePulse(store.state);
    
    // Only update if changed to avoid unnecessary renders
    if (store.state.metrics.momentumScore !== newMetrics.momentumScore ||
        store.state.metrics.queriesToday !== newMetrics.queriesToday ||
        store.state.metrics.completedTasksToday !== newMetrics.completedTasksToday) {
      store.setState(prev => ({ ...prev, metrics: newMetrics }));
    }
  }
};
