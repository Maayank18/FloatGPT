import { syncBus } from '../notifications/bus';
import { JournalEvent } from '../types';
import { useWorkspaceStore } from '../state/workspaceStore';
import { useAppStore } from '../state/store';

class HabitEngineService {
  constructor() {
    syncBus.subscribe((event: any) => {
      if (event.type === 'NEW_JOURNAL_EVENT') {
        this.analyzeEvent(event.payload as JournalEvent);
      }
    });
  }

  private analyzeEvent(event: JournalEvent) {
    if (event.type === 'task_completed') {
      // Analyze task completion and update habit signals
      this.updateHabitProfile(event);
    }
  }

  private updateHabitProfile(event: JournalEvent) {
    const learning = useAppStore.getState().state.settings?.features?.habitMemory !== false;
    if (!learning) return;
    // The profile itself is written by ReflectionService when the task is marked done.
    // A second write here used to replace it with a fixed "Morning/Afternoon" label.
    useWorkspaceStore.getState().setMemory((mem) => ({
      habitSignals: [...(mem.habitSignals || []), { type: 'completion', timestamp: event.timestamp }].slice(-40)
    }));
  }
}

export const habitEngine = new HabitEngineService();
