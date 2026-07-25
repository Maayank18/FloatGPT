import { contextResolver } from '../memory/contextResolver';
import { useSurfaceStore } from '../state/surfaceStores';
import { AppState } from '../types';

export const contextBuilder = {
  buildSystemPrompt(source: 'orb' | 'playground', basePersona: string) {
    const memoryCapsule = contextResolver.resolveMemoryCapsule();
    
    // We do NOT pull the other surface's transcript. We only pull the memory capsule.
    return `
${basePersona}

${memoryCapsule}

You are currently speaking to the user through the ${source === 'orb' ? 'FloatGPT Desktop Orb' : 'Web Playground'}.
Answer their requests contextually based on the Workspace Memory Capsule above, and the recent local chat history provided below.
    `.trim();
  }
};
