/**
 * Flow Agent — Voice Bridge
 *
 * IPC bridge between the Python voice service and the Flow engine.
 * Manages a WebSocket server that the Python subprocess connects to.
 * Receives transcribed text and forwards it to the command router.
 *
 * This module runs in the Electron main process (Node.js).
 * The renderer communicates with it via IPC.
 */

export interface VoiceTranscript {
  type: 'transcript';
  text: string;
  confidence: number;
}

export interface VoiceStatus {
  active: boolean;
  listeningForWakeWord: boolean;
  processing: boolean;
  error: string | null;
}

/**
 * Voice bridge state for the renderer to query.
 */
let voiceStatus: VoiceStatus = {
  active: false,
  listeningForWakeWord: false,
  processing: false,
  error: null,
};

/**
 * Get the current voice service status.
 */
export function getVoiceStatus(): VoiceStatus {
  return { ...voiceStatus };
}

/**
 * Update voice status from the main process.
 */
export function setVoiceStatus(update: Partial<VoiceStatus>): void {
  voiceStatus = { ...voiceStatus, ...update };
}

/**
 * Check if Python 3 is available on the system.
 * This is called before attempting to start the voice service.
 */
export async function checkPythonAvailable(): Promise<boolean> {
  if (typeof window !== 'undefined') {
    // Running in renderer — delegate to main process
    const api = (window as any).electronAPI;
    if (api?.flow?.checkPython) {
      return api.flow.checkPython();
    }
    return false;
  }

  // Running in Node.js (main process)
  try {
    const { execSync } = require('child_process');
    const result = execSync('python3 --version 2>&1 || python --version 2>&1', {
      encoding: 'utf-8',
      timeout: 3000,
    });
    return result.toLowerCase().includes('python 3');
  } catch {
    return false;
  }
}

/**
 * Parse a raw WebSocket message from the voice service.
 */
export function parseVoiceMessage(raw: string): VoiceTranscript | null {
  try {
    const data = JSON.parse(raw);
    if (data.type === 'transcript' && typeof data.text === 'string') {
      return {
        type: 'transcript',
        text: data.text.trim(),
        confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
      };
    }
    return null;
  } catch {
    return null;
  }
}
