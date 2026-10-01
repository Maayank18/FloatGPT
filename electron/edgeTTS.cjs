/**
 * Microsoft Edge Neural Text-to-Speech (TTS) Bridge.
 * 
 * Provides 100% free, zero-API-key human-grade neural speech synthesis using Microsoft Edge's
 * high-fidelity neural voices (e.g. Christopher, Aria, Jenny, Prabhat).
 * Runs in Electron Main process and streams MP3 audio to the renderer.
 * Automatically signals fallback to local OS speech (SAPI) when offline.
 */

const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

// In-memory LRU cache for synthesized speech snippets (max 40 items)
const audioCache = new Map();
const MAX_CACHE_SIZE = 40;

const DEFAULT_VOICE = 'en-US-ChristopherNeural';

/**
 * Normalizes text to prevent SSML parsing errors or awkward pronunciations.
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[*_#`~>\[\]\(\)\{\}]/g, ' ') // Strip markdown symbols
    .replace(/https?:\/\/\S+/g, 'link')    // Don't read full URLs
    .replace(/([0-9]+)\.([0-9]+)\s*GB/gi, '$1 point $2 gigabytes')
    .replace(/([0-9]+)\.([0-9]+)\s*MB/gi, '$1 point $2 megabytes')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Synthesizes text into high-quality neural MP3 audio.
 * @param {string} text - Raw text to synthesize
 * @param {object} options - { voice?: string, rate?: string, pitch?: string }
 * @returns {Promise<{ ok: boolean, audioBase64?: string, mimeType?: string, voice: string, error?: string, fallback?: string }>}
 */
async function synthesize(text, options = {}) {
  const clean = sanitizeText(text);
  if (!clean) {
    return { ok: false, error: 'Empty text to synthesize' };
  }

  const voice = options.voice || DEFAULT_VOICE;
  const cacheKey = `${voice}:::${clean.slice(0, 160)}`;

  if (audioCache.has(cacheKey)) {
    return {
      ok: true,
      audioBase64: audioCache.get(cacheKey),
      mimeType: 'audio/mp3',
      voice,
      cached: true
    };
  }
  try {
    const tts = new MsEdgeTTS();
    await Promise.race([
      tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TTS metadata timeout after 3000ms')), 3000))
    ]);

    const { audioStream } = tts.toStream(clean);
    const chunks = [];

    await new Promise((resolve, reject) => {
      const streamTimer = setTimeout(() => {
        reject(new Error('Edge TTS stream timeout after 4000ms'));
      }, 4000);

      audioStream.on('data', (chunk) => chunks.push(chunk));
      audioStream.on('end', () => {
        clearTimeout(streamTimer);
        resolve();
      });
      audioStream.on('error', (err) => {
        clearTimeout(streamTimer);
        reject(err);
      });
    });

    const totalBuffer = Buffer.concat(chunks);
    const audioBase64 = totalBuffer.toString('base64');

    // Maintain cache size
    if (audioCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = audioCache.keys().next().value;
      audioCache.delete(oldestKey);
    }
    audioCache.set(cacheKey, audioBase64);

    return {
      ok: true,
      audioBase64,
      mimeType: 'audio/mp3',
      voice,
      cached: false
    };
  } catch (err) {
    console.warn('[EdgeTTS] Synthesis failed (network down or offline). Signaling fallback:', err.message);
    return {
      ok: false,
      fallback: 'sapi',
      error: err.message || 'Edge TTS network unavailable'
    };
  }
}

module.exports = {
  synthesize,
  DEFAULT_VOICE
};
