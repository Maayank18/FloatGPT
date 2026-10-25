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
let playToken = 0;
let playTimer: ReturnType<typeof setTimeout> | null = null;

function clearPlayTimer(): void {
  if (playTimer) {
    clearTimeout(playTimer);
    playTimer = null;
  }
}

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
  playToken += 1;
  clearPlayTimer();

  if (currentAudio) {
    try {
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
    currentAudio = null;
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
  currentUtterance = null;
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

  // Interrupt existing speech. A later stop bumps the token so this request cannot start again.
  stopSpeech();
  const token = playToken;
  speaking = true;

  if (options.onStart) options.onStart();
  const stillCurrent = () => token === playToken;

  // 1. Try Microsoft Edge Neural TTS via Electron IPC
  const win = typeof window !== 'undefined' ? window : (globalThis as any).window;
  const ttsApi = win?.electronAPI?.tts?.speak || (globalThis as any).electronAPI?.tts?.speak;

  if (ttsApi) {
    try {
      const res = await ttsApi(clean, {
        voice: options.voice || 'en-US-ChristopherNeural',
        rate: options.rate
      });

      if (res?.ok && res.audioBase64 && stillCurrent()) {
        return new Promise<boolean>((resolve) => {
          const audio = new Audio(`data:${res.mimeType || 'audio/mp3'};base64,${res.audioBase64}`);
          currentAudio = audio;

          const maxPlayDuration = Math.max(5000, clean.length * 120);
          playTimer = setTimeout(() => {
            if (!stillCurrent()) return;
            speaking = false;
            currentAudio = null;
            if (options.onEnd) options.onEnd();
            resolve(true);
          }, maxPlayDuration);

          audio.onended = () => {
            clearPlayTimer();
            if (!stillCurrent()) return;
            speaking = false;
            currentAudio = null;
            if (options.onEnd) options.onEnd();
            resolve(true);
          };

          audio.onerror = () => {
            clearPlayTimer();
            if (!stillCurrent()) return;
            speaking = false;
            currentAudio = null;
            fallbackToWebSpeech(clean, options, token).then(resolve);
          };

          audio.play().catch(() => {
            clearPlayTimer();
            if (!stillCurrent()) {
              resolve(false);
              return;
            }
            fallbackToWebSpeech(clean, options, token).then(resolve);
          });
        });
      }
    } catch (err) {
      console.warn('[SpeechPlayer] Edge-TTS IPC failed, falling back to local SAPI:', err);
    }
  }

  if (!stillCurrent()) return false;

  // 2. Offline Fallback: Local SpeechSynthesis (Windows SAPI / macOS AVFoundation)
  return fallbackToWebSpeech(clean, options, token);
}

function fallbackToWebSpeech(
  text: string,
  options: { voice?: string; onEnd?: () => void } = {},
  token = playToken
): Promise<boolean> {
  if (token !== playToken) return Promise.resolve(false);
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
      playTimer = setTimeout(() => {
        if (token !== playToken) return;
        speaking = false;
        currentUtterance = null;
        if (options.onEnd) options.onEnd();
        resolve(false);
      }, maxSpeechDuration);

      utterance.onend = () => {
        clearPlayTimer();
        if (token !== playToken) return;
        speaking = false;
        currentUtterance = null;
        if (options.onEnd) options.onEnd();
        resolve(true);
      };

      utterance.onerror = () => {
        clearPlayTimer();
        if (token !== playToken) return;
        speaking = false;
        currentUtterance = null;
        if (options.onEnd) options.onEnd();
        resolve(false);
      };

      if (token !== playToken) {
        resolve(false);
        return;
      }
      window.speechSynthesis.speak(utterance);
    } catch {
      speaking = false;
      if (options.onEnd) options.onEnd();
      resolve(false);
    }
  });
}
