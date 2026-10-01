/**
 * FloatGPT Universal Speech Player
 * 
 * High-fidelity neural voice playback with seamless offline fallback:
 * 1. Primary: Microsoft Edge Neural TTS (via Electron IPC bridge) — 100% free, zero API keys.
 * 2. Fallback: Browser/OS SpeechSynthesis (Windows SAPI / macOS AVFoundation) — 100% offline.
 * 3. Interruptibility: Immediately halts ongoing audio when new speech starts or user commands stop.
 */

let currentAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let speaking = false;

export function cleanForSpeech(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const lines = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\s*\*?\((?:Source:|Queried\b|Sampled\b|Aggregated\b)[\s\S]*$/i, '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      const footnote = /^\*?\s*\(?(?:source:|queried|sampled|aggregated)\b/i.test(trimmed)
        || (/^\*?\s*\(/.test(trimmed) && /\b(?:0 tokens|tokens used|100% offline)\b/i.test(trimmed));
      return !footnote;
    });
  return lines.join(' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[•●▪▫]/g, ', ')
    .replace(/[*_#>[\]{}]/g, ' ')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Halts any currently playing speech.
 */
export function stopSpeech(): void {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    } catch {}
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
      currentUtterance = null;
    } catch {}
  }

  speaking = false;
}

/**
 * Returns true if speech audio is currently playing.
 */
export function isSpeaking(): boolean {
  return speaking;
}

/**
 * Speaks text using Microsoft Edge Neural TTS, with instantaneous local SAPI fallback.
 */
export async function playSpeech(
  text: string,
  options: { voice?: string; rate?: string; onStart?: () => void; onEnd?: () => void } = {}
): Promise<boolean> {
  const clean = cleanForSpeech(text);
  if (!clean) {
    if (options.onEnd) options.onEnd();
    return false;
  }

  // Interrupt existing speech
  stopSpeech();
  speaking = true;

  if (options.onStart) options.onStart();

  // 1. Try Microsoft Edge Neural TTS via Electron IPC
  const win = typeof window !== 'undefined' ? window : (globalThis as any).window;
  const ttsApi = win?.electronAPI?.tts?.speak || (globalThis as any).electronAPI?.tts?.speak;

  if (ttsApi) {
    try {
      const res = await ttsApi(clean, {
        voice: options.voice || 'en-US-ChristopherNeural',
        rate: options.rate
      });

      if (res?.ok && res.audioBase64) {
        return new Promise<boolean>((resolve) => {
          const audio = new Audio(`data:${res.mimeType || 'audio/mp3'};base64,${res.audioBase64}`);
          currentAudio = audio;

          const maxPlayDuration = Math.max(5000, clean.length * 120);
          const playTimeout = setTimeout(() => {
            speaking = false;
            currentAudio = null;
            if (options.onEnd) options.onEnd();
            resolve(true);
          }, maxPlayDuration);

          audio.onended = () => {
            clearTimeout(playTimeout);
            speaking = false;
            currentAudio = null;
            if (options.onEnd) options.onEnd();
            resolve(true);
          };

          audio.onerror = () => {
            clearTimeout(playTimeout);
            speaking = false;
            currentAudio = null;
            fallbackToWebSpeech(clean, options).then(resolve);
          };

          audio.play().catch(() => {
            clearTimeout(playTimeout);
            fallbackToWebSpeech(clean, options).then(resolve);
          });
        });
      }
    } catch (err) {
      console.warn('[SpeechPlayer] Edge-TTS IPC failed, falling back to local SAPI:', err);
    }
  }

  // 2. Offline Fallback: Local SpeechSynthesis (Windows SAPI / macOS AVFoundation)
  return fallbackToWebSpeech(clean, options);
}

function fallbackToWebSpeech(
  text: string,
  options: { voice?: string; onEnd?: () => void } = {}
): Promise<boolean> {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    speaking = false;
    if (options.onEnd) options.onEnd();
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      currentUtterance = utterance;

      const maxSpeechDuration = Math.max(4000, text.length * 120);
      const speechTimeout = setTimeout(() => {
        speaking = false;
        currentUtterance = null;
        if (options.onEnd) options.onEnd();
        resolve(false);
      }, maxSpeechDuration);

      utterance.onend = () => {
        clearTimeout(speechTimeout);
        speaking = false;
        currentUtterance = null;
        if (options.onEnd) options.onEnd();
        resolve(true);
      };

      utterance.onerror = () => {
        clearTimeout(speechTimeout);
        speaking = false;
        currentUtterance = null;
        if (options.onEnd) options.onEnd();
        resolve(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      speaking = false;
      if (options.onEnd) options.onEnd();
      resolve(false);
    }
  });
}
