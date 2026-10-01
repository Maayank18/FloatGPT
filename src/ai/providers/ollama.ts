/**
 * Ollama AI Provider
 *
 * Adapter for the local Ollama inference engine.
 * Implements the same AIProvider interface as cloud providers,
 * so it can be used as a drop-in replacement in the orchestrator.
 *
 * No API key required — Ollama runs locally on the user's machine.
 */

import type { ConversationTurn, Attachment } from './types';
import { LOCAL_KEEP_ALIVE, LOCAL_MODEL_ID, LOCAL_NUM_CTX, OLLAMA_BASE_URL } from './localModel';

/**
 * Generate a response using a local Ollama model.
 * Follows the same signature as other provider adapters.
 */
export async function fetchOllama(
  _apiKey: string, // Ignored — Ollama doesn't need a key
  model: string,
  systemInstruction: string,
  history: ConversationTurn[],
  prompt: string,
  temperature: number,
  maxTokens: number,
  _isPlanMode: boolean,
  attachments?: Attachment[],
  _useWebSearch?: boolean
): Promise<any> {
  const messages: Array<{ role: string; content: string; images?: string[] }> = [];

  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  for (const turn of history) {
    messages.push({ role: turn.role, content: turn.content });
  }

  const images = (attachments || [])
    .filter((file) => file?.data && String(file.mimeType || '').startsWith('image/'))
    .map((file) => String(file.data).replace(/^data:[^;]+;base64,/, ''))
    .slice(0, 2);

  messages.push({
    role: 'user',
    content: prompt,
    ...(images.length ? { images } : {})
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || LOCAL_MODEL_ID,
        messages,
        stream: false,
        think: false,
        keep_alive: LOCAL_KEEP_ALIVE,
        options: {
          temperature,
          num_predict: maxTokens,
          num_ctx: LOCAL_NUM_CTX,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Ollama returned ${res.status}: ${errorText}`);
    }

    const data = await res.json();

    // Return in the same format as cloud providers
    return {
      message: data.message?.content?.trim() || '',
    };
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('The local model took too long to answer. Run npm run dev again in a moment.');
    }
    throw err;
  }
}
