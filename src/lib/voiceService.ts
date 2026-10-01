/**
 * FloatGPT Voice Transcription Service
 * 
 * Enterprise-Grade Hybrid Engine:
 * 1. Web Speech API for real-time live preview (where supported).
 * 2. MediaRecorder + Groq Whisper Large-v3 / OpenAI Whisper fallback (100% reliability in Electron & all browsers).
 * 3. Multi-key pool rotation for Whisper API.
 * 4. Automatic alias resolution for OS commands & app names.
 */

import { resolveAlias } from '../agent/aliasResolver';
import { chooseHeardSpeech } from './heardSpeech';

export interface VoiceServiceOptions {
  apiKey?: string;
  fallbackKeys?: string[];
  provider?: 'groq' | 'openai' | 'auto';
  onInterimResult?: (text: string) => void;
  onFinalResult?: (text: string) => void;
  onError?: (error: string) => void;
  onStateChange?: (isRecording: boolean) => void;
}

export class VoiceService {
  private isRecording = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private speechRecognition: any = null;
  private stream: MediaStream | null = null;
  private interimText = '';
  private finalTranscript = '';
  private options: VoiceServiceOptions;

  constructor(options: VoiceServiceOptions = {}) {
    this.options = options;
  }

  public updateOptions(options: Partial<VoiceServiceOptions>) {
    this.options = { ...this.options, ...options };
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get all candidate API keys for Whisper transcription
   */
  private getCandidateKeys(): { key: string; provider: 'groq' | 'openai' }[] {
    const list: { key: string; provider: 'groq' | 'openai' }[] = [];
    const seen = new Set<string>();

    const add = (k?: string, p?: 'groq' | 'openai' | 'auto') => {
      if (!k || typeof k !== 'string') return;
      const trimmed = k.trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      let provider: 'groq' | 'openai';
      if (trimmed.startsWith('gsk_')) {
        provider = 'groq';
      } else if (trimmed.startsWith('sk-')) {
        provider = 'openai';
      } else if (p === 'openai' || p === 'groq') {
        provider = p;
      } else {
        provider = 'groq';
      }
      list.push({ key: trimmed, provider });
    };

    // 1. User supplied keys
    add(this.options.apiKey, this.options.provider);
    if (this.options.fallbackKeys) {
      this.options.fallbackKeys.forEach(k => add(k));
    }

    // 2. Vite environment bundled keys
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        add(import.meta.env.VITE_GROQ_API_KEY, 'groq');
        add(import.meta.env.VITE_GROQ_API_KEY_2, 'groq');
        add(import.meta.env.VITE_GROQ_API_KEY_3, 'groq');
        add(import.meta.env.VITE_GROQ_API_KEY_4, 'groq');
        add(import.meta.env.VITE_GROQ_API_KEY_5, 'groq');
        add(import.meta.env.VITE_GROQ_API_KEY_6, 'groq');
        add(import.meta.env.VITE_GROQ_API_KEY_7, 'groq');
        add(import.meta.env.VITE_GROQ_API_KEY_8, 'groq');
        add(import.meta.env.VITE_GROQ_API_KEY_9, 'groq');
        add(import.meta.env.VITE_GROQ_API_KEY_10, 'groq');
        add(import.meta.env.VITE_OPENAI_API_KEY, 'openai');
      }
    } catch (e) {}

    return list;
  }

  /**
   * Start listening to microphone input
   */
  public async start(): Promise<void> {
    if (this.isRecording) return;

    this.audioChunks = [];
    this.interimText = '';
    this.finalTranscript = '';
    let speechRecognitionActive = false;

    // 1. Initialize Web Speech API for real-time live preview (if supported by environment)
    const SpeechRecognition = typeof window !== 'undefined' 
      ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
      : null;

    if (SpeechRecognition) {
      try {
        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.continuous = true;
        this.speechRecognition.interimResults = true;
        this.speechRecognition.lang = 'en-IN';

        this.speechRecognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              this.finalTranscript += transcript + ' ';
            } else {
              interim += transcript;
            }
          }
          const fullCurrent = (this.finalTranscript + interim).trim();
          this.interimText = fullCurrent;
          if (this.options.onInterimResult && fullCurrent) {
            this.options.onInterimResult(resolveAlias(fullCurrent));
          }
        };

        this.speechRecognition.onerror = (event: any) => {
          console.warn('[VoiceService] WebSpeech notice (will transcribe with Whisper):', event.error);
        };

        this.speechRecognition.onend = () => {
          if (this.isRecording && this.speechRecognition) {
            try { this.speechRecognition.start(); } catch (e) {}
          }
        };

        this.speechRecognition.start();
        speechRecognitionActive = true;
      } catch (err) {
        console.warn('[VoiceService] WebSpeech API unavailable, continuing with MediaRecorder:', err);
      }
    }

    // 2. Initialize MediaRecorder for high-fidelity audio capture (Whisper backend)
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });

        let mimeType = '';
        if (typeof MediaRecorder !== 'undefined') {
          const supportedTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4;codecs=mp4a.40.2',
            'audio/mp4',
            'audio/aac',
            'audio/ogg;codecs=opus',
            'audio/wav'
          ];
          for (const type of supportedTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
              mimeType = type;
              break;
            }
          }
        }

        this.mediaRecorder = mimeType 
          ? new MediaRecorder(this.stream, { mimeType }) 
          : new MediaRecorder(this.stream);

        this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
          if (event.data && event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        this.mediaRecorder.start(200); // 200ms audio chunks
      }
    } catch (mediaErr: any) {
      console.error('[VoiceService] Microphone access error:', mediaErr);
      if (!speechRecognitionActive) {
        if (this.options.onError) {
          this.options.onError(`Microphone error: ${mediaErr.message || 'Permission denied'}`);
        }
        return;
      }
    }

    this.isRecording = true;
    if (this.options.onStateChange) this.options.onStateChange(true);
  }

  /**
   * Stop recording and return transcribed text
   */
  public async stop(): Promise<string> {
    if (!this.isRecording) return this.finalTranscript.trim();

    this.isRecording = false;
    if (this.options.onStateChange) this.options.onStateChange(false);

    // 1. Stop Web Speech
    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
        this.speechRecognition = null;
      } catch (e) {}
    }

    // 2. Stop MediaRecorder and grab audio blob
    let audioBlob: Blob | null = null;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      await Promise.race([
        new Promise<void>((resolve) => {
          if (!this.mediaRecorder) return resolve();
          this.mediaRecorder.onstop = () => {
            const type = this.mediaRecorder?.mimeType || 'audio/webm';
            audioBlob = new Blob(this.audioChunks, { type });
            resolve();
          };
          try {
            this.mediaRecorder.stop();
          } catch (e) {
            resolve();
          }
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 2000))
      ]);
    }

    // Fallback: If onstop didn't set audioBlob but audio chunks exist
    if (!audioBlob && this.audioChunks.length > 0) {
      const type = this.mediaRecorder?.mimeType || 'audio/webm';
      audioBlob = new Blob(this.audioChunks, { type });
    }

    // 3. Release microphone hardware tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    const browserHeard = this.finalTranscript.trim() || this.interimText.trim();
    let whisperHeard = '';

    if (audioBlob && (audioBlob as Blob).size > 200) {
      try {
        whisperHeard = (await this.transcribeWithWhisper(audioBlob)).trim();
      } catch (err: any) {
        console.error('[VoiceService] Whisper transcription error:', err);
      }
    }

    let finalResult = resolveAlias(chooseHeardSpeech(browserHeard, whisperHeard));

    // Cleanly reset internal transcription buffers so stale transcripts never bleed into subsequent queries
    this.finalTranscript = '';
    this.interimText = '';
    this.audioChunks = [];

    if (this.options.onFinalResult && finalResult) {
      this.options.onFinalResult(finalResult);
    }

    return finalResult;
  }

  /**
   * Transcribes audio using Groq Whisper Large-v3 or OpenAI Whisper
   */
  private async transcribeWithWhisper(blob: Blob): Promise<string> {
    return transcribeBlobWithWhisper(blob, {
      apiKey: this.options.apiKey,
      fallbackKeys: this.options.fallbackKeys,
      provider: this.options.provider
    });
  }
}

/**
 * Exported standalone helper for transcribing an audio blob using Groq Whisper Large-v3 or OpenAI Whisper.
 * Available to VoiceService, AmbientWakeEngine, and other voice subagents.
 */
export async function transcribeBlobWithWhisper(
  blob: Blob,
  customKeys?: { apiKey?: string; fallbackKeys?: string[]; provider?: 'groq' | 'openai' | 'auto' }
): Promise<string> {
  const candidateKeys: { key: string; provider: 'groq' | 'openai' }[] = [];
  const seen = new Set<string>();

  const add = (k?: string, p?: 'groq' | 'openai' | 'auto') => {
    if (!k || typeof k !== 'string') return;
    const trimmed = k.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    let provider: 'groq' | 'openai';
    if (trimmed.startsWith('gsk_')) {
      provider = 'groq';
    } else if (trimmed.startsWith('sk-')) {
      provider = 'openai';
    } else if (p === 'openai' || p === 'groq') {
      provider = p;
    } else {
      provider = 'groq';
    }
    candidateKeys.push({ key: trimmed, provider });
  };

  if (customKeys) {
    add(customKeys.apiKey, customKeys.provider);
    if (customKeys.fallbackKeys) {
      customKeys.fallbackKeys.forEach(k => add(k));
    }
  }

  // Vite environment bundled keys
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      const env = (import.meta as any).env;
      add(env.VITE_GROQ_API_KEY, 'groq');
      add(env.VITE_GROQ_API_KEY_2, 'groq');
      add(env.VITE_GROQ_API_KEY_3, 'groq');
      add(env.VITE_GROQ_API_KEY_4, 'groq');
      add(env.VITE_GROQ_API_KEY_5, 'groq');
      add(env.VITE_GROQ_API_KEY_6, 'groq');
      add(env.VITE_GROQ_API_KEY_7, 'groq');
      add(env.VITE_GROQ_API_KEY_8, 'groq');
      add(env.VITE_GROQ_API_KEY_9, 'groq');
      add(env.VITE_GROQ_API_KEY_10, 'groq');
      add(env.VITE_OPENAI_API_KEY, 'openai');
    }
  } catch (e) {}

  if (candidateKeys.length === 0) {
    console.warn('[VoiceService] No API keys available for Whisper transcription');
    return '';
  }

  let extension = 'webm';
  if (blob.type.includes('mp4') || blob.type.includes('aac') || blob.type.includes('m4a')) {
    extension = 'mp4';
  } else if (blob.type.includes('wav')) {
    extension = 'wav';
  } else if (blob.type.includes('ogg')) {
    extension = 'ogg';
  }

  for (const { key, provider } of candidateKeys) {
    try {
      const formData = new FormData();
      formData.append('file', blob, `recording.${extension}`);
      formData.append('model', provider === 'groq' ? 'whisper-large-v3' : 'whisper-1');
      formData.append('temperature', '0');
      formData.append('response_format', 'json');

      const endpoint = provider === 'groq'
        ? 'https://api.groq.com/openai/v1/audio/transcriptions'
        : 'https://api.openai.com/v1/audio/transcriptions';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        if (data && typeof data.text === 'string') {
          return data.text.trim();
        }
      }
    } catch (err) {
      console.warn(`[VoiceService] Failed to transcribe with key:`, err);
    }
  }

  return '';
}
