/**
 * AI Orchestrator
 * Central entry point for all AI generation requests.
 * Coordinates provider selection, intent routing, context compression, 
 * prompt building, and fallback execution into a single clean pipeline.
 */

import { AppState, INITIAL_STATE } from '../types';
import { buildSystemInstructionForMode } from './prompts/system';
import { buildConversationContext } from './memory/context';
import { buildModeSpecificContext } from './context/compressor';
import { classifyIntent } from './router';
import { getProvider } from './providers/registry';
import { executeWithFallback } from './fallbacks/retry';
import { AILogger } from './observability/logger';
import type { OverrideConfig } from './providers/types';
import { parseStructuredResponse } from './validation/response'; // Explicitly imported if needed by provider adapters, but adapters handle it internally if isPlanMode=true. Wait, adapters handle parsing if isPlanMode is true.

/**
 * Main function to orchestrate the AI generation request.
 */
export async function generateAIResponse(
  state: AppState,
  prompt: string,
  attachments?: any[],
  useWebSearch?: boolean,
  overrideConfig?: OverrideConfig
): Promise<any> {
  const config = state?.settings?.aiConfig || INITIAL_STATE.settings.aiConfig;
  
  // --- 1. Resolve Provider, Model, and API Key ---
  const providerId = overrideConfig ? overrideConfig.providerId : (config.selectedProvider || 'groq');
  let model = overrideConfig ? overrideConfig.model : (config.selectedModels?.[providerId as keyof typeof config.selectedModels] || 'llama-3.3-70b-versatile');
  const apiKey = overrideConfig ? overrideConfig.apiKey : config.apiKeys?.[providerId as keyof typeof config.apiKeys];

  if (model === 'llama3-70b-8192') model = 'llama-3.3-70b-versatile';
  if (model === 'llama3-8b-8192') model = 'llama-3.1-8b-instant';

  const { temperature, maxTokens, contextWindow } = config.parameters || INITIAL_STATE.settings.aiConfig.parameters;
  
  // The frontend toggle state:
  const isPlanModeToggle = config.isPlanMode !== false; 
  const customChatContext = config.customChatContext || '';

  const scope = overrideConfig?.isSystemScope ? 'Playground System Mode' : 'Float Runtime (User Mode)';
  AILogger.logKeyResolution(scope, providerId, !!apiKey);

  if (!apiKey || apiKey.trim() === '') {
    throw new Error(`API key missing for provider: ${providerId.toUpperCase()}. Please configure it in Settings.`);
  }

  const provider = getProvider(providerId);
  if (!provider) {
    throw new Error(`Unsupported AI Provider: ${providerId}`);
  }

  AILogger.logRequest(scope, provider.name, model);
  const startTime = Date.now();

  try {
    // --- 2. Classify Intent (Router) ---
    const mode = await classifyIntent(prompt, isPlanModeToggle, provider, { apiKey, model });
    console.log(`[AI:Router] Classified intent: ${mode}`);

    // --- 3. Compress Context ---
    const compressedState = buildModeSpecificContext(state, mode);

    // --- 4. Build System Instruction ---
    const systemInstruction = buildSystemInstructionForMode(state, mode, compressedState, customChatContext);

    // --- 5. Build Conversation Context (Memory-filtered) ---
    const recentHistory = buildConversationContext(
      state.messages || [],
      config.memoryHorizonDays || 7,
      contextWindow
    );

    // Determines if the provider adapter should strictly return parsed JSON or normal text.
    // Only mutator modes generate JSON plans.
    const requiresJson = (mode === 'plan_create' || mode === 'plan_update');

    // --- 6. Execute with Fallback ---
    const result = await executeWithFallback(
      provider,
      [], // No automatic fallback to different providers right now
      {
        apiKey,
        fallbackApiKeys: overrideConfig?.fallbackApiKeys,
        model,
        systemInstruction,
        history: recentHistory,
        prompt,
        temperature: requiresJson ? temperature : 0.7, // Slightly higher temp for chat/review
        maxTokens,
        isPlanMode: requiresJson,
        attachments,
        useWebSearch
      },
      2 // maxRetries on transient errors
    );

    AILogger.logSuccess(provider.id, Date.now() - startTime);
    return result;
  } catch (error: any) {
    AILogger.logFailure(provider.id, error.message, false);
    throw new Error(error.message || "Failed to generate AI response.");
  }
}
