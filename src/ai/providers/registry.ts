/**
 * Provider Registry
 * Central lookup for all registered AI provider adapters.
 * Uses the adapter pattern — adding a new provider requires only:
 * 1. Create a new adapter file in providers/
 * 2. Register it here
 */

import type { AIProvider } from './types';
import { fetchGoogleGemini } from './gemini';
import { createOpenAICompatibleProvider } from './openai';
import { fetchAnthropic } from './anthropic';

const openaiGenerate = createOpenAICompatibleProvider(
  'https://api.openai.com/v1/chat/completions', 
  'OpenAI'
);

const groqGenerate = createOpenAICompatibleProvider(
  'https://api.groq.com/openai/v1/chat/completions', 
  'Groq'
);

const ProviderRegistry: Record<string, AIProvider> = {
  google: {
    id: 'google',
    name: 'Google (Gemini)',
    generate: fetchGoogleGemini
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (GPT)',
    generate: openaiGenerate
  },
  groq: {
    id: 'groq',
    name: 'Groq (Llama / Mixtral)',
    generate: groqGenerate
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    generate: fetchAnthropic
  }
};

/**
 * Looks up a provider by ID. Returns null if not found.
 */
export function getProvider(id: string): AIProvider | null {
  return ProviderRegistry[id] || null;
}

/**
 * Returns all registered provider IDs.
 */
export function getAvailableProviderIds(): string[] {
  return Object.keys(ProviderRegistry);
}
