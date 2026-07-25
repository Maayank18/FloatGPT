import { syncBus } from '../notifications/bus';
import { JournalEvent, ExecutionProfile, HabitProfile } from '../types';
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
    // In a full implementation, this uses sliding window metrics to calculate execution profile.
    // For now, we stub this out as requested.
    const currentStore = useAppStore.getState();
    const currentProfile = currentStore.state.habitProfile;
    
    // Example signal extraction
    const updatedProfile: HabitProfile = {
      ...currentProfile,
      activeHours: 'Morning/Afternoon', // Derived from event.timestamp
    };

    // Update global state
    currentStore.setState((prev: any) => ({ ...prev, habitProfile: updatedProfile }));
    
    // Add to workspace memory signals
    useWorkspaceStore.getState().setMemory((mem) => ({
      habitSignals: [...mem.habitSignals, { type: 'completion', timestamp: event.timestamp }]
    }));
  }
}

export const habitEngine = new HabitEngineService();
