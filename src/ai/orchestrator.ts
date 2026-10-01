/**
 * AI Orchestrator
 * Central entry point for all AI generation requests.
 * Coordinates fast-path routing, provider selection, intent routing, 
 * context compression, dynamic token budgeting, and fallback execution.
 */

import { AppState, INITIAL_STATE } from '../types';
import { buildSystemInstructionForMode } from './prompts/system';
import { buildConversationContext } from './memory/context';
import { buildModeSpecificContext } from './context/compressor';
import { classifyIntent, type AIIntentMode } from './router';
import { getProvider } from './providers/registry';
import { executeWithFallback } from './fallbacks/retry';
import { AILogger } from './observability/logger';
import { TokenTelemetry } from './observability/telemetry';
import type { OverrideConfig } from './providers/types';
import { parseStructuredResponse } from './validation/response';
import { documentContext, closedFileReply } from '../rag';
import { processSlashCommand, postProcessSlashCommand, slashSubject, missingSlashHelp } from '../chat';
import { isModelSlash } from '../chat/commandRouter';
import { analyzeCommandSecurity } from '../agent/securityGuard';
import { detectPlatform } from '../platform';
import { tryFastRoute } from './fastRouter';
import { resolveProviderKeyPool, getAvailableProviderPool } from './config/keyPool';
import { detectSystemDiagIntent, runSystemDiagnostics, looksLikeMemoryScript } from '../platform/osDiagnostics';
import { looksLikeOsDump, executeLocalOsIntent } from '../platform/osLaunch';
import { inspectLocalModel, localFailureMessage, resolveChatRoute } from './providers/localModel';

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
  const startTime = Date.now();

  // ─── 0. Zero-Token Deterministic Fast-Path Router ─────────────
  if (!attachments?.length && !isModelSlash(prompt)) {
    const fastResult = await tryFastRoute(prompt, state);
    if (fastResult.handled) {
      TokenTelemetry.record({
        provider: 'deterministic',
        model: 'fast-path-engine',
        routeType: 'FAST_PATH',
        inputTokensEstimated: 0,
        outputTokensEstimated: TokenTelemetry.estimateTokens(fastResult.message || ''),
        latencyMs: Date.now() - startTime,
        success: true
      });
      return { message: fastResult.message };
    }
  }

  if (!attachments?.length && !isModelSlash(prompt)) {
    const closed = closedFileReply(prompt, state);
    if (closed) {
      return { message: closed };
    }
  }

  const config = state?.settings?.aiConfig || INITIAL_STATE.settings.aiConfig;
  
  // ─── 1. Resolve Provider, Model, and Key Pool ────────────────
  const requestedProvider = overrideConfig?.providerId || config.selectedProvider || 'groq';
  const scope = overrideConfig?.isSystemScope ? 'Playground System Mode' : 'Float Runtime (User Mode)';

  // Automatic Provider Failover: If requested provider lacks an API key, dynamically route
  // to an alternative provider with valid keys (e.g. Groq with 7 pooled keys)
  const poolResult = getAvailableProviderPool(requestedProvider, {
    apiKeys: config.apiKeys
  });

  const route = resolveChatRoute({
    requestedProvider,
    overrideProviderId: overrideConfig?.providerId,
    overrideApiKey: overrideConfig?.apiKey,
    poolProviderId: poolResult.providerId,
    primaryKey: poolResult.primaryKey
  });

  let providerId = route.providerId;
  let apiKey = route.local ? route.apiKey : (overrideConfig?.apiKey || poolResult.primaryKey);
  const fallbackApiKeys = route.local ? [] : (overrideConfig?.fallbackApiKeys || poolResult.fallbackKeys);

  if (!route.local && providerId !== requestedProvider && apiKey) {
    AILogger.logFallback(requestedProvider, providerId, `Missing API key; auto-failing over with ${1 + fallbackApiKeys.length} pooled keys`);
    if (state?.settings?.aiConfig && !overrideConfig?.providerId) {
      state.settings.aiConfig.selectedProvider = providerId as any;
    }
  }

  const validGroqModels = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'deepseek-r1-distill-llama-70b',
    'gemma2-9b-it',
    'mixtral-8x7b-32768'
  ];
  let model = route.local
    ? route.model!
    : (overrideConfig?.model || (config.selectedModels?.[providerId as keyof typeof config.selectedModels] || (providerId === 'groq' ? 'openai/gpt-oss-120b' : 'gemini-2.5-flash')));
  if (!route.local && providerId === 'groq' && !validGroqModels.includes(model)) {
    model = 'openai/gpt-oss-120b';
  }

  if (!route.local && isThinkingMode) {
    if (providerId === 'groq') model = 'deepseek-r1-distill-llama-70b';
    else if (providerId === 'openai') model = 'o3-mini';
    else if (providerId === 'google') model = 'gemini-2.5-pro';
    else if (providerId === 'anthropic') model = 'claude-3-7-sonnet-20250219';
  }

  const { temperature, contextWindow } = config.parameters || INITIAL_STATE.settings.aiConfig.parameters;
  const isPlanModeToggle = config.isPlanMode === true; 
  const customChatContext = config.customChatContext || '';

  AILogger.logKeyResolution(scope, providerId, !!apiKey, 1 + fallbackApiKeys.length);

  if (route.local) {
    const ready = await inspectLocalModel();
    if (!ready.ok) return { message: ready.message };
  } else if (!apiKey || apiKey.trim() === '') {
    const diagKind = detectSystemDiagIntent(prompt);
    if (diagKind) {
      const diagMsg = await runSystemDiagnostics(diagKind);
      return { message: diagMsg };
    }
    throw new Error(`API key missing for provider: ${providerId.toUpperCase()}. Please configure it in Settings.`);
  }

  const provider = getProvider(providerId);
  if (!provider) {
    throw new Error(`Unsupported AI Provider: ${providerId}`);
  }

  AILogger.logRequest(scope, provider.name, model);

  try {
    // ─── 2. Intercept Slash Commands ─────────────────────────────
    const slashResult = processSlashCommand(prompt, state);

    // ─── 3. Classify Intent ──────────────────────────────────────
    let mode: AIIntentMode = 'general_chat';
    if (overrideConfig?.isOsAgent) {
      mode = 'general_chat';
    } else {
      mode = slashResult.isCommand ? 'general_chat' : await classifyIntent(prompt, isPlanModeToggle, provider, { apiKey, fallbackApiKeys, model });
    }

    // ─── 4. Compress Active Context Capsule ──────────────────────
    const compressedState = buildModeSpecificContext(state, mode);

    const platform = detectPlatform();
    const isMac = platform === 'darwin';
    const isDesktopGlance = prompt.includes('[FLOATGPT_DESKTOP_GLANCE]');

    // ─── 5. Build System Instruction ─────────────────────────────
    let systemInstruction = slashResult.isCommand 
      ? slashResult.systemInstruction!
      : buildSystemInstructionForMode(state, mode, compressedState, customChatContext);
      
    if (overrideConfig?.isOsAgent) {
      systemInstruction = `You are FloatGPT OS agent. Call execute_os_command with one complete ${isMac ? 'zsh/osascript' : 'PowerShell'} script. Never truncate. Never invent RAM/CPU — those are handled locally. No destructive commands.`;
    }

    const requiresJson = slashResult.isCommand ? false : (mode === 'plan_create' || mode === 'plan_update');

    const historyTurns = overrideConfig?.skipHistory || isDesktopGlance || slashResult.isCommand
      ? 0
      : overrideConfig?.isOsAgent
        ? 2
        : Math.min(Math.max(contextWindow || 16, 12), 24);

    const transcriptSource = overrideConfig?.isPlayground
      ? (state.playgroundMessages || [])
      : (state.messages || []);
    const lastTurn = transcriptSource[transcriptSource.length - 1];
    const transcript = lastTurn && lastTurn.role === 'user' && lastTurn.content === prompt
      ? transcriptSource.slice(0, -1)
      : transcriptSource;

    const recentHistory = buildConversationContext(
      transcript,
      config.memoryHorizonDays || 7,
      historyTurns
    );

    if (recentHistory.length > 0 && !slashResult.isCommand) {
      systemInstruction += '\n\nYou are continuing this same chat. Remember names, decisions, and facts already said in the conversation. Do not ask the user to repeat them.';
    }

    // ─── 7. Contextual RAG Injection ─────────────────────────────
    let finalPrompt = slashResult.isCommand ? slashResult.strippedPrompt : prompt;
    if (slashResult.isCommand && slashResult.command && isModelSlash(prompt)) {
      const subject = slashSubject(slashResult.command, slashResult.strippedPrompt, transcript);
      if (!subject) return { message: missingSlashHelp(slashResult.command) };
      finalPrompt = subject;
    }
    let finalAttachments = attachments ? [...attachments] : [];

    const skipDocument = slashResult.command === 'rewrite'
      || slashResult.command === 'one-liner'
      || slashResult.command === 'image'
      || slashResult.command === 'translate'
      || slashResult.command === 'email';
    const contextStr = skipDocument ? '' : documentContext(finalPrompt, state, transcript);
    if (contextStr) {
      finalPrompt = `${finalPrompt}\n\n${contextStr}\n\n**Instructions:** Answer from the document excerpts above when the question is about that file. If the excerpts do not contain the answer, say so. Do not invent facts from the file.`;
    }

    // ─── 8. Gated Tool Schema Attachment ─────────────────────────
    const lowerPrompt = prompt.toLowerCase();
    const requiresOsTool = !isDesktopGlance && (overrideConfig?.isOsAgent ||
      (!slashResult.isCommand && !requiresJson && (
        /\b(open|launch|start|kholo|run)\b/i.test(lowerPrompt)
        || /\b(whatsapp|youtube|spotify|calculator|notepad|settings|chrome|edge|browser|terminal|cmd|powershell|explorer|word|excel|code)\b/i.test(lowerPrompt)
        || /\b(volume|mute|unmute)\b/i.test(lowerPrompt)
        || /\b(create|write)\s+(a\s+)?(file|folder)\b/i.test(lowerPrompt)
      )));

    const tools = (typeof window !== 'undefined' && (window as any).electronAPI && requiresOsTool) ? [
      {
        name: "execute_os_command",
        description: isMac 
          ? "Execute a native macOS shell or AppleScript command (e.g. open -a 'Safari', osascript)."
          : "Execute a PowerShell script on Windows to automate apps, inspect files, or control settings.",
        parameters: {
          type: "object",
          properties: {
            script: {
              type: "string",
              description: isMac ? "The shell command or AppleScript." : "The raw PowerShell script."
            }
          },
          required: ["script"]
        }
      }
    ] : undefined;

    // ─── 9. Dynamic Max Token Allocation ─────────────────────────
    let dynamicMaxTokens = 512;
    if (slashResult.isCommand) {
      if (slashResult.command === 'one-liner') dynamicMaxTokens = 120;
      else if (slashResult.command === 'image') dynamicMaxTokens = 160;
      else if (slashResult.command === 'translate') dynamicMaxTokens = 1200;
      else if (slashResult.command === 'email') dynamicMaxTokens = 800;
      else if (slashResult.command === 'diagram' || slashResult.command === 'architecture') dynamicMaxTokens = 900;
      else if (slashResult.command === 'table' || slashResult.command === 'research' || slashResult.command === 'plan' || slashResult.command === 'review') dynamicMaxTokens = 800;
      else dynamicMaxTokens = 600;
    } else if (requiresJson) {
      dynamicMaxTokens = 2048;
    } else if (isDesktopGlance) {
      dynamicMaxTokens = 384;
    } else if (requiresOsTool) {
      dynamicMaxTokens = 1024;
    } else {
      dynamicMaxTokens = 512;
    }

    // ─── 10. Execute Model Call with Bounded Retries ─────────────
    const result = await executeWithFallback(
      provider,
      [],
      {
        apiKey,
        fallbackApiKeys,
        model,
        systemInstruction,
        history: recentHistory,
        prompt: finalPrompt,
        temperature: slashResult.isCommand ? 0.2 : (requiresJson ? temperature : 0.7), 
        maxTokens: dynamicMaxTokens,
        isPlanMode: requiresJson,
        attachments: finalAttachments.length > 0 ? finalAttachments : undefined,
        useWebSearch: useWebSearch || (slashResult.isCommand && slashResult.command === 'research'),
        tools 
      },
      route.local ? 0 : 2
    );

    if (route.local && typeof result?.message === 'string' && result.message.includes('AI Service Error')) {
      result.message = localFailureMessage(result.message);
    }

    // ─── 11. Security Guard & Action Broker Execution ───────────
    let scriptToExecute = '';
    let isOsCommand = false;

    if (result.isToolCall && result.toolName === 'execute_os_command') {
      scriptToExecute = result.toolArgs?.script || '';
      isOsCommand = true;
    } else if (typeof result.message === 'string') {
      // Defense-in-depth: Extract simulated tool call embedded in model text!
      // Pattern 1: JSON block containing {"execute_os_command": {"script": "..."}}
      const jsonToolMatch = result.message.match(/```(?:json)?\s*(\{[\s\S]*?"execute_os_command"[\s\S]*?\})\s*```/i)
        || result.message.match(/(\{[\s\S]*?"execute_os_command"[\s\S]*?\})/i);
      
      if (jsonToolMatch) {
        try {
          const parsed = JSON.parse(jsonToolMatch[1]);
          if (parsed.execute_os_command?.script) {
            scriptToExecute = parsed.execute_os_command.script;
            isOsCommand = true;
            // Clean the JSON codeblock out of the message so the user gets clean text
            result.message = result.message.replace(jsonToolMatch[0], '').trim();
          }
        } catch {}
      }

      // Pattern 2: {"name": "execute_os_command", "parameters" | "arguments": {"script": "..."}}
      if (!isOsCommand) {
        const altJsonMatch = result.message.match(/```(?:json)?\s*(\{[\s\S]*?"name"\s*:\s*"execute_os_command"[\s\S]*?\})\s*```/i)
          || result.message.match(/(\{[\s\S]*?"name"\s*:\s*"execute_os_command"[\s\S]*?\})/i);
        if (altJsonMatch) {
          try {
            const parsed = JSON.parse(altJsonMatch[1]);
            const s = parsed.parameters?.script || parsed.arguments?.script || parsed.script;
            if (s) {
              scriptToExecute = s;
              isOsCommand = true;
              result.message = result.message.replace(altJsonMatch[0], '').trim();
            }
          } catch {}
        }
      }
    }

    if (isOsCommand && scriptToExecute) {
      let script = scriptToExecute;
      const scriptLang = isMac ? 'bash' : 'powershell';
      script = script.replace(/SendKeys\((['"][^'"]*['"])\s*;/g, 'SendKeys($1);');

      // Direct URL check: if script is simply opening a web URL, use native openUrl!
      const urlMatch = script.match(/https?:\/\/[^\s"']+/);
      if (urlMatch && /^(start|start-process|open)\b/i.test(script.trim())) {
        const targetUrl = urlMatch[0];
        if (typeof window !== 'undefined' && (window as any).electronAPI?.flow) {
          await (window as any).electronAPI.flow.openUrl(targetUrl);
          return {
            message: result.message || `🌐 Opened **${targetUrl}** in your browser.`
          };
        }
      }

      const dumpedLaunch = looksLikeOsDump(script);
      if (dumpedLaunch) {
        const ran = await executeLocalOsIntent(dumpedLaunch);
        return { message: ran.message };
      }

      const diagKind = detectSystemDiagIntent(prompt) || (looksLikeMemoryScript(script) ? 'ram' as const : null);
      const scriptLooksBroken = !script.trim() || /[({,=]\s*$/.test(script.trim()) || (script.match(/"/g) || []).length % 2 === 1 || /\bGet-WmiObject\s+Win[0-9]*$/i.test(script);
      if (diagKind && (scriptLooksBroken || looksLikeMemoryScript(script) || /\b(Win32_Battery|Win32_Processor)\b/i.test(script))) {
        const message = await runSystemDiagnostics(diagKind);
        return { message };
      }
      if (scriptLooksBroken) {
        return {
          message: '⚠️ That OS command was **cut off** before it could run (unsafe to execute a half-written script). Ask again in a short phrase, e.g. **how much RAM is used** — FloatGPT will read the kernel directly.'
        };
      }
      
      const analysis = analyzeCommandSecurity(script);

      if (analysis.riskLevel === 'BLOCKED') {
        return { 
          message: `🛡️ **Security Alert: Execution Blocked**\n\nFloatGPT's Security Firewall detected a restricted operation:\n\n> **Category:** ${analysis.category}\n> **Reason:** ${analysis.reason}\n\n\`\`\`${scriptLang}\n${script}\n\`\`\`` 
        };
      }

      if (analysis.riskLevel === 'REQUIRES_CONFIRMATION') {
        const securityPayload = JSON.stringify({
          category: analysis.category,
          reason: analysis.reason,
          script: analysis.script
        });
        return {
          message: `🛡️ **Security Firewall Notice**\n\nFloatGPT detected an operation that modifies system resources:\n\n<!-- SECURITY_PROMPT_CARD: ${securityPayload} -->`
        };
      }

      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const executionResult = await (window as any).electronAPI.flow.executeScript(script);
        return { 
          message: executionResult.success
            ? (result.message ? `${result.message}\n\n` : '') + `Executed command successfully.\n\n\`\`\`${scriptLang}\n${script}\n\`\`\`\n\nOutput:\n\`\`\`\n${executionResult.output || 'No output'}\n\`\`\``
            : `Failed to execute command:\n\n\`\`\`${scriptLang}\n${script}\n\`\`\`\n\nError:\n\`\`\`\n${executionResult.output}\n\`\`\``
        };
      }
    }

    if (!slashResult.isCommand && !result.isToolCall && looksLikeMemoryScript(result.message || '')) {
      result.message = await runSystemDiagnostics('ram');
    }

    if (!slashResult.isCommand && !result.isToolCall) {
      const dumped = looksLikeOsDump(result.message || '');
      if (dumped) {
        const ran = await executeLocalOsIntent(dumped);
        result.message = ran.message;
      }
    }

    if (slashResult.isCommand && slashResult.command) {
      result.message = postProcessSlashCommand(slashResult.command, result.message);
    }

    const duration = Date.now() - startTime;
    AILogger.logSuccess(provider.id, duration);

    TokenTelemetry.record({
      provider: provider.id,
      model,
      routeType: requiresJson ? 'LLM_TIER_2' : 'LLM_TIER_1',
      inputTokensEstimated: TokenTelemetry.estimateTokens(systemInstruction + finalPrompt),
      outputTokensEstimated: TokenTelemetry.estimateTokens(result.message || ''),
      latencyMs: duration,
      success: true
    });

    return result;
  } catch (error: any) {
    const diagKind = isModelSlash(prompt) ? null : detectSystemDiagIntent(prompt);
    if (diagKind) {
      try {
        const diagMsg = await runSystemDiagnostics(diagKind);
        return { message: diagMsg };
      } catch {}
    }
    AILogger.logFailure(provider?.id || providerId, error.message, false);
    throw new Error(error.message || "Failed to generate AI response.");
  }
}