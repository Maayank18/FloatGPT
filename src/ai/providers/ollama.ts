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

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

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
  _attachments?: Attachment[],
  _useWebSearch?: boolean
): Promise<any> {
  // Build messages array in OpenAI-compatible format
  const messages: Array<{ role: string; content: string }> = [];

  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  for (const turn of history) {
    messages.push({ role: turn.role, content: turn.content });
  }

  messages.push({ role: 'user', content: prompt });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000); // 60s timeout for reasoning

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens,
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
      throw new Error('Ollama request timed out after 60s');
    }
    throw err;
  }
}
