import { create } from 'zustand';
import { WorkspaceMemory, MemorySummary, Goal, Project, Task } from '../types';
import { FirebaseAdapter } from '../persistence/firebaseAdapter';
import { auth, onAuthStateChanged } from '../lib/firebase';
import { User } from 'firebase/auth';

interface WorkspaceStore {
  memory: WorkspaceMemory;
  user: User | null;
  isLoaded: boolean;
  addSummary: (summary: MemorySummary) => void;
  setMemory: (memory: Partial<WorkspaceMemory> | ((prev: WorkspaceMemory) => Partial<WorkspaceMemory>)) => void;
  init: () => void;
}

export const INITIAL_WORKSPACE_MEMORY: WorkspaceMemory = {
  activeGoals: [],
  activeProjects: [],
  tasks: [],
  recentSummaries: [],
  importantDecisions: [],
  habitSignals: [],
  executionStatus: 'Idle'
};

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  memory: INITIAL_WORKSPACE_MEMORY,
  user: null,
  isLoaded: false,

  addSummary: (summary) => {
    set((state) => {
      const updatedSummaries = [...state.memory.recentSummaries, summary].slice(-50);
      const newMemory = { ...state.memory, recentSummaries: updatedSummaries };
      if (state.user) {
         FirebaseAdapter.saveWorkspace(state.user.uid, newMemory);
      }
      return { memory: newMemory };
    });
  },

  setMemory: (action) => {
    set((state) => {
      const nextPartial = typeof action === 'function' ? action(state.memory) : action;
      const nextMemory = { ...state.memory, ...nextPartial };
      if (state.user) {
         FirebaseAdapter.saveWorkspace(state.user.uid, nextMemory);
      }
      return { memory: nextMemory };
    });
  },

  init: () => {
    onAuthStateChanged(auth, async (user) => {
      set({ user });
      if (user) {
        try {
          const stored = await FirebaseAdapter.getWorkspace(user.uid);
          if (stored) {
            set({ memory: { ...INITIAL_WORKSPACE_MEMORY, ...stored }, isLoaded: true });
          } else {
            set({ memory: INITIAL_WORKSPACE_MEMORY, isLoaded: true });
          }
        } catch (err) {
          console.error('[WorkspaceStore] Error loading workspace:', err);
          set({ isLoaded: true });
        }
      } else {
        set({ memory: INITIAL_WORKSPACE_MEMORY, isLoaded: true });
      }
    });
  }
}));
