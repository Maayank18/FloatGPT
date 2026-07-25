import { create } from 'zustand';
import { SurfaceTranscript, Message } from '../types';

interface SurfaceStore {
  transcript: SurfaceTranscript;
  addOrbMessage: (message: Message) => void;
  addPlaygroundMessage: (message: Message) => void;
  setOrbMessages: (messages: Message[]) => void;
  setPlaygroundMessages: (messages: Message[]) => void;
  clearOrb: () => void;
  clearPlayground: () => void;
}

const INITIAL_SURFACE: SurfaceTranscript = {
  orbTranscript: [],
  playgroundTranscript: []
};

// Surface stores are purely local UI state, they do not sync directly via Firestore last-writer-wins.
// This prevents cross-tab overwrite bugs.
export const useSurfaceStore = create<SurfaceStore>((set) => ({
  transcript: INITIAL_SURFACE,

  addOrbMessage: (message) => set((state) => ({
    transcript: {
      ...state.transcript,
      orbTranscript: [...state.transcript.orbTranscript, message]
    }
  })),

  addPlaygroundMessage: (message) => set((state) => ({
    transcript: {
      ...state.transcript,
      playgroundTranscript: [...state.transcript.playgroundTranscript, message]
    }
  })),

  setOrbMessages: (messages) => set((state) => ({
    transcript: {
      ...state.transcript,
      orbTranscript: messages
    }
  })),

  setPlaygroundMessages: (messages) => set((state) => ({
    transcript: {
      ...state.transcript,
      playgroundTranscript: messages
    }
  })),

  clearOrb: () => set((state) => ({
    transcript: { ...state.transcript, orbTranscript: [] }
  })),

  clearPlayground: () => set((state) => ({
    transcript: { ...state.transcript, playgroundTranscript: [] }
  }))
}));
