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
import { classifyIntent, type AIIntentMode } from './router';
import { getProvider } from './providers/registry';
import { executeWithFallback } from './fallbacks/retry';
import { AILogger } from './observability/logger';
import type { OverrideConfig } from './providers/types';
import { parseStructuredResponse } from './validation/response';
import { requiresRetrieval } from './multimodal/router';
import { retrieveContext, getAllImageContexts } from './retrieval/retriever';
import { processSlashCommand, postProcessSlashCommand } from '../chat';

/**
 * Main function to orchestrate the AI generation request.
 */
export async function generateAIResponse(
  state: AppState,
  prompt: string,
  attachments?: any[],
  useWebSearch?: boolean,
  overrideConfig?: OverrideConfig,
  isThinkingMode?: boolean
): Promise<any> {
  const config = state?.settings?.aiConfig || INITIAL_STATE.settings.aiConfig;
  
  // --- 1. Resolve Provider, Model, and API Key ---
  const providerId = overrideConfig ? overrideConfig.providerId : (config.selectedProvider || 'groq');
  const validGroqModels = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.6-27b',
    'llama-3.3-70b-versatile'
  ];
  let model = overrideConfig ? overrideConfig.model : (config.selectedModels?.[providerId as keyof typeof config.selectedModels] || 'openai/gpt-oss-120b');
  if (providerId === 'groq' && !validGroqModels.includes(model)) {
    model = 'openai/gpt-oss-120b';
  }
  let apiKey = overrideConfig ? overrideConfig.apiKey : config.apiKeys?.[providerId as keyof typeof config.apiKeys];

  // Fallback to local .env variables if API key is not found in settings
  if (!apiKey || apiKey.trim() === '') {
    if (providerId === 'groq') apiKey = import.meta.env.VITE_GROQ_API_KEY || import.meta.env.GROQ_API_KEY;
    else if (providerId === 'google') apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
    else if (providerId === 'openai') apiKey = import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY;
  }

  // Groq model IDs are provider-specific and must match Groq's supported names.
  if (providerId === 'groq' && (model === 'llama3-70b-8192' || model === 'llama3-8b-8192')) {
    model = 'llama-3.3-70b-versatile';
  }

  if (isThinkingMode) {
    if (providerId === 'groq') model = 'deepseek-r1-distill-llama-70b';
    else if (providerId === 'openai') model = 'o3-mini';
    else if (providerId === 'google') model = 'gemini-2.0-pro-exp-02-05';
    else if (providerId === 'anthropic') model = 'claude-3-7-sonnet-20250219';
  }

  const { temperature, maxTokens, contextWindow } = config.parameters || INITIAL_STATE.settings.aiConfig.parameters;
  
  // The frontend toggle state:
  const isPlanModeToggle = config.isPlanMode !== false; 
  const customChatContext = config.customChatContext || '';

  const scope = overrideConfig?.isSystemScope ? 'Playground System Mode' : 'Float Runtime (User Mode)';
  AILogger.logKeyResolution(scope, providerId, !!apiKey);

  if (!apiKey || apiKey.trim() === '') {
    throw new Error(`API key missing for provider: ${providerId.toUpperCase()}. Keys found: ${JSON.stringify(config.apiKeys)}. Please configure it in Settings.`);
  }

  const provider = getProvider(providerId);
  if (!provider) {
    throw new Error(`Unsupported AI Provider: ${providerId}`);
  }

  AILogger.logRequest(scope, provider.name, model);
  const startTime = Date.now();

  try {
    // --- 1.5 Intercept Slash Commands ---
    const slashResult = processSlashCommand(prompt, state);

    // --- 2. Classify Intent (Router) ---
    // Bypass intent classification for strict commands or OS Agent routing
    let mode: AIIntentMode = 'general_chat';
    if (overrideConfig?.isOsAgent) {
      mode = 'general_chat';
    } else {
      mode = slashResult.isCommand ? 'general_chat' : await classifyIntent(prompt, isPlanModeToggle, provider, { apiKey, model });
    }
    
    if (!slashResult.isCommand && !overrideConfig?.isOsAgent) {
      console.log(`[AI:Router] Classified intent: ${mode}`);
    }

    // --- 3. Compress Context ---
    // If it's a command, we don't need massive workspace context unless requested. We'll pass it for now just in case.
    const compressedState = buildModeSpecificContext(state, mode);

    // --- 4. Build System Instruction ---
    // Override standard conversational prompt with the strict command template
    let systemInstruction = slashResult.isCommand 
      ? slashResult.systemInstruction!
      : buildSystemInstructionForMode(state, mode, compressedState, customChatContext);
      
    if (overrideConfig?.isOsAgent) {
      systemInstruction += "\n\nCRITICAL DIRECTIVE: The user wants to execute a command on their OS (e.g. open an app, change settings, control the OS). You MUST use the `execute_os_command` tool to fulfill this request. Generate the correct PowerShell script (e.g. `Start-Process control`) and call the tool immediately. Do NOT answer conversationally.";
    }

    // --- 5. Build Conversation Context (Memory-filtered) ---
    const recentHistory = buildConversationContext(
      state.messages || [],
      config.memoryHorizonDays || 7,
      contextWindow
    );

    // Determines if the provider adapter should strictly return parsed JSON or normal text.
    // Only mutator modes generate JSON plans. Commands NEVER generate JSON plans.
    const requiresJson = slashResult.isCommand ? false : (mode === 'plan_create' || mode === 'plan_update');

    // --- Multimodal / Retrieval Injection ---
    let finalPrompt = slashResult.isCommand ? slashResult.strippedPrompt : prompt;
    let finalAttachments = attachments ? [...attachments] : [];
    
    if (true) {
      if (requiresRetrieval(prompt, state)) {
        const contextStr = retrieveContext(prompt, state, 3);
        if (contextStr) {
          finalPrompt = `${prompt}\n\n${contextStr}\n\n**Instructions:** Answer the user's query using the retrieved knowledge sources above. Cite the source names (e.g., "[Source 1: filename.pdf (Page 2)]") when providing factual answers. If the answer is not in the sources, do not make it up. Be extremely concise.`;
        }
      }

      // If we have images, inject them for vision models (Google/OpenAI support this via attachments)
      const imageContexts = getAllImageContexts(state);
      if (imageContexts.length > 0) {
        // We only append them if they aren't already attached to this specific message
        imageContexts.forEach(img => {
          finalAttachments.push({
            name: 'knowledge_base_image',
            mimeType: img.mimeType,
            data: img.data
          });
        });
      }
    }

    // --- OS Execution Tool (Omnipotent OS Agent) ---
    const tools = typeof window !== 'undefined' && (window as any).electronAPI ? [
      {
        name: "execute_os_command",
        description: "Execute a PowerShell command on the user's Windows machine. Use this to open apps, control system settings, and manipulate the OS. IMPORTANT: When creating or accessing files on Desktop, Documents, or Downloads, ALWAYS use $([Environment]::GetFolderPath('Desktop')) or $([Environment]::GetFolderPath('MyDocuments')) instead of hardcoded $env:USERPROFILE\\Desktop, because OneDrive redirects visible user folders.",
        parameters: {
          type: "object",
          properties: {
            script: {
              type: "string",
              description: "The raw PowerShell script to execute (e.g. '$d = [Environment]::GetFolderPath(\"Desktop\"); New-Item -Path \"$d\\filename.txt\" -ItemType File -Force' or 'Start-Process control')"
            }
          },
          required: ["script"]
        }
      }
    ] : [];

    // --- 6. Execute with Fallback ---
    const toolList = (slashResult.isCommand || mode === 'plan_create') ? undefined : tools;
    
    // Extract fallback keys from .env if they exist
    const fallbackApiKeys = [];
    if (providerId === 'groq') {
      const key2 = import.meta.env.VITE_GROQ_API_KEY_2 || import.meta.env.GROQ_API_KEY_2;
      const key3 = import.meta.env.VITE_GROQ_API_KEY_3 || import.meta.env.GROQ_API_KEY_3;
      if (key2) fallbackApiKeys.push(key2);
      if (key3) fallbackApiKeys.push(key3);
    } else if (providerId === 'openai') {
      const key2 = import.meta.env.VITE_OPENAI_API_KEY_2 || import.meta.env.OPENAI_API_KEY_2;
      if (key2) fallbackApiKeys.push(key2);
    } else if (providerId === 'google') {
      const key2 = import.meta.env.VITE_GEMINI_API_KEY_2 || import.meta.env.GEMINI_API_KEY_2;
      if (key2) fallbackApiKeys.push(key2);
    }

    const result = await executeWithFallback(
      provider,
      [], // No automatic fallback to different providers right now
      {
        apiKey,
        fallbackApiKeys: (overrideConfig?.fallbackApiKeys || []).concat(fallbackApiKeys).filter(Boolean) as string[],
        model,
        systemInstruction,
        history: recentHistory,
        prompt: finalPrompt,
        // Strict deterministic temperature for commands, otherwise mode-based
        temperature: slashResult.isCommand ? 0.2 : (requiresJson ? temperature : 0.7), 
        maxTokens,
        isPlanMode: requiresJson && !toolList, // Only use JSON mode if NOT using tools
        attachments: finalAttachments.length > 0 ? finalAttachments : undefined,
        useWebSearch: useWebSearch || (slashResult.isCommand && slashResult.command === 'research'),
        tools: toolList 
      },
      2 // maxRetries on transient errors
    );

    // If the AI decided to call a tool, execute it securely
    if (result.isToolCall && result.toolName === 'execute_os_command') {
      const script = result.toolArgs?.script;
      
      // Safety Check: Block highly destructive commands
      const dangerousKeywords = ['remove-item', 'del ', 'format ', 'stop-process', 'kill', 'netsh', 'reg add', 'reg delete'];
      const isDangerous = dangerousKeywords.some(kw => script.toLowerCase().includes(kw));

      if (isDangerous) {
        return { 
          message: `⚠️ **Security Alert:** I generated a command that might be destructive or modify system settings. For your safety, I blocked execution.\n\n\`\`\`powershell\n${script}\n\`\`\`\n\nIf you want to run this, please execute it manually in your terminal.` 
        };
      }

      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        AILogger.logSuccess(provider.id, Date.now() - startTime);
        
        // Let the user know we are executing something
        const executionResult = await (window as any).electronAPI.flow.executeScript(script);
        
        if (executionResult.success) {
          return { message: `Executed command successfully.\n\n\`\`\`powershell\n${script}\n\`\`\`\n\nOutput:\n\`\`\`\n${executionResult.output || 'No output'}\n\`\`\`` };
        } else {
          return { message: `Failed to execute command:\n\n\`\`\`powershell\n${script}\n\`\`\`\n\nError:\n\`\`\`\n${executionResult.output}\n\`\`\`` };
        }
      }
    }

    if (slashResult.isCommand && slashResult.command) {
      result.message = postProcessSlashCommand(slashResult.command, result.message);
    }

    AILogger.logSuccess(provider.id, Date.now() - startTime);
    return result;
  } catch (error: any) {
    AILogger.logFailure(provider.id, error.message, false);
    throw new Error(error.message || "Failed to generate AI response.");
  }
}
