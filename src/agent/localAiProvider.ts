/**
 * Flow Agent — Local AI Provider (Ollama Adapter)
 *
 * Connects to a locally running Ollama instance for fast, offline AI inference.
 * Used for command classification and simple Q&A so we don't burn cloud API keys.
 *
 * Health status is cached and refreshed every 30 seconds.
 * If Ollama is unavailable, the Flow engine falls back to regex or cloud.
 */

export interface OllamaHealthStatus {
  available: boolean;
  models: string[];
  checkedAt: number;
}

interface OllamaGenerateOptions {
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
  /** Max time in ms before aborting (default 10000) */
  timeoutMs?: number;
}

interface OllamaGenerateResponse {
  response: string;
  model: string;
  done: boolean;
}

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const HEALTH_CACHE_TTL_MS = 30_000;

let cachedHealth: OllamaHealthStatus | null = null;

/**
 * Check if Ollama is running and which models are available.
 * Result is cached for 30 seconds.
 */
export async function checkOllamaHealth(forceRefresh = false): Promise<OllamaHealthStatus> {
  if (!forceRefresh && cachedHealth && Date.now() - cachedHealth.checkedAt < HEALTH_CACHE_TTL_MS) {
    return cachedHealth;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      cachedHealth = { available: false, models: [], checkedAt: Date.now() };
      return cachedHealth;
    }

    const data = await res.json();
    const models = (data.models || []).map((m: any) => m.name || m.model);

    cachedHealth = { available: true, models, checkedAt: Date.now() };
    console.log(`[Flow:Ollama] Health check passed. Models: ${models.join(', ') || 'none'}`);
    return cachedHealth;
  } catch {
    cachedHealth = { available: false, models: [], checkedAt: Date.now() };
    console.log('[Flow:Ollama] Health check failed — Ollama is not running');
    return cachedHealth;
  }
}

/**
 * Generate a completion from Ollama.
 * Returns the response text, or throws on timeout/error.
 */
export async function ollamaGenerate(options: OllamaGenerateOptions): Promise<string> {
  const { model, prompt, system, temperature = 0.3, timeoutMs = 10_000 } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        system: system || undefined,
        stream: false,
        options: { temperature },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Ollama returned ${res.status}: ${errorText}`);
    }

    const data: OllamaGenerateResponse = await res.json();
    return data.response.trim();
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error(`Ollama request timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

/**
 * Classify the intent of a user command using a local Ollama model.
 * Parses noisy STT text into a clean JSON intent.
 */
export async function classifyIntentLocal(
  text: string,
  model: string = 'gemma2:2b'
): Promise<any> {
  const systemPrompt = `You are a strict command parser. Given a noisy, transcribed voice command, parse it into a JSON object.
Allowed intents: "memory_query", "os_action", "browser_action", "floatgpt_control", "general_chat", "plan_action".
If intent is "os_action", provide "action": "open_app" and "appName".
If intent is "browser_action", provide "action": "open_url" or "search_web" and "query".
For complex browser commands, construct the exact URL in the "query" field (Deep Linking). 
- If user wants to message someone on WhatsApp: "query": "https://web.whatsapp.com/send?text=[msg]"
- If user wants to open a specific LeetCode problem: "query": "https://www.google.com/search?q=leetcode+problem+[number]" or the exact URL if known.
- If user wants to open LinkedIn: "query": "https://linkedin.com"
Respond ONLY with raw JSON. Do not include markdown formatting or backticks.`;

  try {
    const response = await ollamaGenerate({
      model,
      prompt: `Command: "${text}"`,
      system: systemPrompt,
      temperature: 0.1,
      timeoutMs: 8000,
    });

    // Strip markdown formatting if the model still includes it
    const cleanResponse = response.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleanResponse);
    return parsed;
  } catch (err: any) {
    console.error('[Flow:Ollama] Failed to classify intent:', err.message);
    // Fallback to general chat
    return { intent: 'general_chat', message: text };
  }
}

/**
 * Ask Ollama a question and get a concise answer.
 * Used for memory-based Q&A where we provide context.
 */
export async function ollamaAnswer(
  question: string,
  context: string,
  model: string = 'gemma2:2b'
): Promise<string> {
  const systemPrompt = `You are Flow, a concise desktop assistant for FloatGPT. Answer the user's question based on the provided workspace context. Be brief, direct, and helpful. If the context doesn't contain enough information, say so honestly.`;

  return ollamaGenerate({
    model,
    prompt: `Context:\n${context}\n\nQuestion: ${question}`,
    system: systemPrompt,
    temperature: 0.4,
    timeoutMs: 15_000,
  });
}
