/**
 * FloatGPT Ambient Wake Word & Voice Activity Detection (VAD) Engine
 * 
 * 100% Client-Side, Ultra-Low CPU, Dual-Engine Architecture:
 * 1. Hardware Microphone VAD (getUserMedia + AnalyserNode + Groq Whisper Large-v3):
 *    - Runs 100% reliably in Electron & any desktop environment without Google Speech API dependency.
 *    - Real-time RMS audio energy detection with dynamic background noise floor tracking.
 *    - Captures speech utterances and transcribes in ~200ms using Groq Whisper.
 * 2. Concurrent Web Speech API:
 *    - Runs in parallel where supported for instant zero-latency speech preview.
 * 3. Wake Words: "Hey Float", "Hey Flow", "Float", "Flow", "Float can you help me", etc.
 * 4. Activation Chime: Web Audio API synthesized dual-tone oscillator chime (zero audio files needed).
 * 5. Loopback Suppression: Self-mutes while FloatGPT is speaking to prevent self-triggering.
 */

import { transcribeBlobWithWhisper } from './voiceService';
import { resolveAlias } from '../agent/aliasResolver';

export interface WakeEngineOptions {
  onWake?: (detectedPhrase: string) => void;
  onInterimText?: (text: string) => void;
  onCommand?: (command: string) => void;
  onError?: (err: string) => void;
  onListeningChange?: (listening: boolean) => void;
}

/**
 * Strict Wake-Word Pattern.
 * Must strictly match at the START of speech (optionally preceded by filler like "um", "uh", "ah", "hey"):
 * - "hey float" / "hey flow"
 * - "float" / "flow" (as standalone or starting invocations)
 * - "ok float" / "ok flow"
 * - "hi float" / "hi flow" / "hello float" / "hello flow"
 * - "float can you help me" / "flow can you help me"
 * 
 * Rejects:
 * - Conversational mentions: "cash flow", "workflow", "air flow", "overflow"
 * - Sentences where float/flow appears in the middle ("I think this boat will float")
 * - Unrelated ambient chatter
 */
const STRICT_START_WAKE_REGEX = /^(?:(?:um|uh|ah|ok|okay|hey|hi|hello)\s+)?(hey\s+float|hey\s+flow|float\s+can\s+you\s+help\s+me|flow\s+can\s+you\s+help\s+me|ok\s+float|ok\s+flow|hi\s+float|hi\s+flow|hello\s+float|hello\s+flow|float|flow)\b/i;

// Rejection pattern for conversational false-positives
const CONVERSATIONAL_FALSE_POSITIVE = /\b(workflow|cashflow|overflow|counterflow|backflow|underflow|air\s+flow|cash\s+flow|data\s+flow|traffic\s+flow|will\s+float|can\s+float|does\s+float)\b/i;

export class AmbientWakeEngine {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private vadChunks: Blob[] = [];
  private isRecordingVAD = false;
  private vadInterval: any = null;
  private silenceStartTime: number | null = null;
  private speechStartTime: number | null = null;
  private noiseFloor = 0.015;
  private mimeType = '';

  private recognition: any = null;
  private isRunning = false;
  private isProcessingCommand = false;
  private options: WakeEngineOptions;
  private activeWakeTimeout: any = null;
  private isInActiveSession = false;

  constructor(options: WakeEngineOptions = {}) {
    this.options = options;
  }

  public updateOptions(opts: Partial<WakeEngineOptions>) {
    this.options = { ...this.options, ...opts };
  }

  /**
   * Synthesize a gentle, premium activation chime using Web Audio API.
   * Zero external MP3/WAV assets required — 100% offline & instantaneous.
   */
  public playChime(type: 'wake' | 'success' = 'wake'): void {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      const now = this.audioContext.currentTime;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      if (type === 'wake') {
        // High-fidelity ascending dual-tone chime (587Hz -> 880Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.12); // A5

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.start(now);
        osc.stop(now + 0.3);
      } else {
        // Subdued confirmation tone (523Hz -> 659Hz)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch {
      // AudioContext unavailable or blocked — ignore safely
    }
  }

  /**
   * Start ambient wake word listening using Hardware VAD + WebSpeech fallback.
   */
  public async start(): Promise<boolean> {
    if (this.isRunning) return true;

    try {
      // 1. Request microphone access to open hardware stream
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });

        // Resolve supported audio recording mime type
        if (typeof MediaRecorder !== 'undefined') {
          const supportedTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4;codecs=mp4a.40.2',
            'audio/mp4',
            'audio/ogg;codecs=opus',
            'audio/wav'
          ];
          for (const t of supportedTypes) {
            if (MediaRecorder.isTypeSupported(t)) {
              this.mimeType = t;
              break;
            }
          }
        }

        // Initialize Web Audio API Analyser for real-time VAD
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
          if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume().catch(() => {});
          }
          const source = this.audioContext.createMediaStreamSource(this.stream);
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 512;
          this.analyser.smoothingTimeConstant = 0.4;
          source.connect(this.analyser);

          this.startVADLoop();
        }
      }

      // 2. Start concurrent Web Speech API if supported
      this.initWebSpeech();

      this.isRunning = true;
      if (this.options.onListeningChange) {
        this.options.onListeningChange(true);
      }

      console.log('[WakeEngine] Ambient voice detection started successfully.');
      return true;
    } catch (err: any) {
      console.warn('[WakeEngine] Failed to initialize ambient audio capture:', err);
      // Fallback: try WebSpeech independently if getUserMedia failed
      this.initWebSpeech();
      return false;
    }
  }

  /**
   * Real-time Voice Activity Detection (VAD) loop.
   * Analyzes raw audio RMS volume every 50ms without burning CPU.
   */
  private startVADLoop(): void {
    if (this.vadInterval) clearInterval(this.vadInterval);

    const bufferLength = this.analyser ? this.analyser.frequencyBinCount : 0;
    const dataArray = new Uint8Array(bufferLength);

    this.vadInterval = setInterval(() => {
      if (!this.analyser || !this.isRunning) return;

      this.analyser.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / bufferLength);

      // Dynamically track background room noise floor
      this.noiseFloor = 0.97 * this.noiseFloor + 0.03 * rms;
      const speechThreshold = Math.max(0.022, this.noiseFloor * 2.2);

      // Self-mute while assistant is speaking/processing to prevent feedback loops
      if (this.isProcessingCommand) {
        if (this.isRecordingVAD) {
          this.cancelVADRecording();
        }
        return;
      }

      if (rms > speechThreshold) {
        // Voice / speech active
        if (!this.isRecordingVAD) {
          this.startVADRecording();
        }
        this.silenceStartTime = null;
      } else {
        // Silence
        if (this.isRecordingVAD) {
          if (!this.silenceStartTime) {
            this.silenceStartTime = Date.now();
          } else if (Date.now() - this.silenceStartTime > 850) {
            // Silence of >850ms detected after speech -> user finished speaking!
            this.finishVADRecording();
          }
        }
      }
    }, 50);
  }

  /**
   * Starts capturing an audio segment when voice energy begins.
   */
  private startVADRecording(): void {
    if (!this.stream || this.isRecordingVAD) return;

    try {
      this.vadChunks = [];
      this.mediaRecorder = this.mimeType
        ? new MediaRecorder(this.stream, { mimeType: this.mimeType })
        : new MediaRecorder(this.stream);

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.vadChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100);
      this.isRecordingVAD = true;
      this.speechStartTime = Date.now();
      this.silenceStartTime = null;
    } catch (err) {
      console.warn('[WakeEngine] Failed to start VAD recording:', err);
    }
  }

  /**
   * Completes an audio segment and passes to Whisper for rapid transcription.
   */
  private async finishVADRecording(): Promise<void> {
    if (!this.mediaRecorder || !this.isRecordingVAD) return;

    this.isRecordingVAD = false;
    const duration = Date.now() - (this.speechStartTime || 0);
    this.speechStartTime = null;
    this.silenceStartTime = null;

    // Ignore tiny transient noises (e.g. keyboard taps < 350ms)
    if (duration < 350) {
      try { this.mediaRecorder.stop(); } catch {}
      this.vadChunks = [];
      return;
    }

    try {
      await new Promise<void>((resolve) => {
        if (!this.mediaRecorder) return resolve();
        this.mediaRecorder.onstop = () => resolve();
        try {
          this.mediaRecorder.stop();
        } catch {
          resolve();
        }
      });

      const blob = new Blob(this.vadChunks, { type: this.mimeType || 'audio/webm' });
      this.vadChunks = [];

      if (blob.size > 1000) {
        // Rapid Whisper transcription (~200ms)
        const transcript = await transcribeBlobWithWhisper(blob);
        if (transcript && transcript.trim().length > 0) {
          this.handleTranscriptStream(transcript.trim());
        }
      }
    } catch (err) {
      console.warn('[WakeEngine] VAD transcription failed:', err);
    }
  }

  /**
   * Cancels any active VAD recording without processing (e.g. when assistant starts speaking).
   */
  private cancelVADRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch {}
    }
    this.vadChunks = [];
    this.isRecordingVAD = false;
    this.silenceStartTime = null;
    this.speechStartTime = null;
  }

  /**
   * Initialize concurrent Web Speech API where supported.
   */
  private initWebSpeech(): void {
    const SpeechRecognition = typeof window !== 'undefined'
      ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
      : null;

    if (!SpeechRecognition) return;

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        if (this.isProcessingCommand) return;

        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        const combined = (final || interim).trim();
        if (combined) {
          this.handleTranscriptStream(combined);
        }
      };

      this.recognition.onerror = () => {
        // Silently ignore WebSpeech errors (e.g. Electron Google cloud key missing)
        // because the Hardware VAD + Whisper engine handles everything seamlessly!
      };

      this.recognition.onend = () => {
        if (this.isRunning && !this.isProcessingCommand) {
          setTimeout(() => {
            try { this.recognition?.start(); } catch {}
          }, 500);
        }
      };

      this.recognition.start();
    } catch {
      // Ignored
    }
  }

  /**
   * Handles incoming real-time speech stream and performs wake matching + command dispatch.
   */
  public handleTranscriptStream(rawText: string): void {
    const text = resolveAlias(rawText.trim());
    if (!text) return;

    // Fast-path: Instant stop / exit / done / finish command check
    // Allows user to say "stop", "exit", "done", "finish", "Hey Float stop", "Float exit" to cease rotation & speech
    const isStopCommand = /^(?:(?:hey\s+)?(?:float|flow)\s+)?(stop|exit|done|finish|cancel|dismiss|nevermind|never\s+mind|close|band\s+karo|chup)$/i.test(text.trim());
    if (isStopCommand) {
      this.playChime('success');
      this.dispatchCommand('stop');
      return;
    }

    // 0. High-speed gate: if the text doesn't contain "float" or "flow", reject immediately!
    const lower = text.toLowerCase();
    if (!lower.includes('float') && !lower.includes('flow')) {
      return;
    }

    // 1. If not yet in an active session, look for strict wake word at start of speech
    if (!this.isInActiveSession) {
      // Reject if it's a known conversational term (e.g. "cash flow", "workflow", "air flow")
      if (CONVERSATIONAL_FALSE_POSITIVE.test(text) && !/^(hey\s+float|hey\s+flow)\b/i.test(text)) {
        return;
      }

      const match = text.match(STRICT_START_WAKE_REGEX);
      if (match && typeof match.index === 'number') {
        const fullMatched = match[0];
        const detectedPhrase = match[1] || match[0];
        const remainder = text.slice(match.index + fullMatched.length).trim();

        this.isInActiveSession = true;
        this.playChime('wake');

        if (this.options.onWake) {
          this.options.onWake(detectedPhrase);
        }

        // Check if user spoke command in the exact same utterance (e.g. "Hey Float, zoom in")
        const cleanRemainder = remainder.replace(/^[,\s.-]+/, '').trim();
        if (cleanRemainder.length > 0) {
          this.dispatchCommand(cleanRemainder);
        } else {
          // User only said "Hey Float" — start listening window for command
          this.startActiveWindowSafetyTimer();
        }
      }
    } else {
      // 2. We are in an active session: user spoke following the wake word
      const cleanText = text.replace(STRICT_START_WAKE_REGEX, '').replace(/^[,\s.-]+/, '').trim();
      if (cleanText.length > 0) {
        this.dispatchCommand(cleanText);
      }
    }
  }

  /**
   * Dispatches the recognized command to the assistant orchestrator.
   */
  private dispatchCommand(command: string): void {
    this.resetActiveSession();
    this.isProcessingCommand = true;

    if (this.options.onCommand) {
      this.options.onCommand(command);
    }
  }

  /**
   * Safety timer if user wakes assistant with "Hey Float" but hesitates.
   * Gives them 6 seconds to speak before returning to idle.
   */
  private startActiveWindowSafetyTimer(): void {
    if (this.activeWakeTimeout) clearTimeout(this.activeWakeTimeout);
    this.activeWakeTimeout = setTimeout(() => {
      this.resetActiveSession();
      if (this.options.onListeningChange) {
        this.options.onListeningChange(false);
      }
    }, 6000);
  }

  /**
   * Notifies the engine that the assistant has finished processing / speaking,
   * so ambient listening can resume safely without hearing itself.
   */
  public notifyAssistantIdle(): void {
    this.isProcessingCommand = false;
    this.resetActiveSession();
  }

  /**
   * Temporarily pauses ambient wake detection (e.g. during Push-to-Talk).
   */
  public pause(): void {
    this.isProcessingCommand = true;
    this.cancelVADRecording();
    this.resetActiveSession();
  }

  /**
   * Resets internal active session buffers.
   */
  private resetActiveSession(): void {
    if (this.activeWakeTimeout) clearTimeout(this.activeWakeTimeout);
    this.activeWakeTimeout = null;
    this.isInActiveSession = false;
  }

  /**
   * Stops the ambient wake engine completely.
   */
  public stop(): void {
    this.isRunning = false;
    this.isProcessingCommand = false;
    this.resetActiveSession();

    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }

    this.cancelVADRecording();

    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }

    if (this.options.onListeningChange) {
      this.options.onListeningChange(false);
    }
  }

  public getIsActive(): boolean {
    return this.isRunning;
  }
}
