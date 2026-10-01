/**
 * Flow Router — Intelligent Command Routing
 * 
 * Separates routing logic from execution.
 * 1. Fast Regex Match
 * 2. Ollama Intent Parsing (Structured JSON)
 * 3. Execution delegation
 */

import {
  type FlowCommand,
  type FlowResponse,
  type FlowIntent,
} from './commandSchemas';
import { executeOSAction } from './osActions';
import { queryMemory, buildFullContext } from './memoryQuery';
import { generateAIResponse } from '../ai/orchestrator';
import { tryFastRoute } from '../ai/fastRouter';
import { useAppStore } from '../state/store';
import { getFlowConfig } from './flowEngine';
import { resolveAlias } from './aliasResolver';
import { detectPlatform } from '../platform';

// Known websites that should route to browser_action, not os_action
const KNOWN_WEBSITES: Record<string, string> = {
  'linkedin': 'https://linkedin.com',
  'youtube': 'https://youtube.com',
  'github': 'https://github.com',
  'google': 'https://google.com',
  'twitter': 'https://twitter.com',
  'x': 'https://x.com',
  'facebook': 'https://facebook.com',
  'chatgpt': 'https://chatgpt.com',
  'leetcode': 'https://leetcode.com',
  'reddit': 'https://reddit.com',
  'stackoverflow': 'https://stackoverflow.com',
  'stack overflow': 'https://stackoverflow.com',
  'gmail': 'https://mail.google.com',
  'instagram': 'https://instagram.com',
  'whatsapp': 'https://web.whatsapp.com',
  'whatsapp web': 'https://web.whatsapp.com',
  'web whatsapp': 'https://web.whatsapp.com',
  'watsapp': 'https://web.whatsapp.com',
  'watsapp web': 'https://web.whatsapp.com',
  'spotify': 'https://open.spotify.com',
  'netflix': 'https://netflix.com',
  'amazon': 'https://amazon.com',
  'gemini': 'https://gemini.google.com',
  'google ai studio': 'https://aistudio.google.com',
  'gemini ai studio': 'https://aistudio.google.com',
  'gemini studio': 'https://aistudio.google.com',
  'groq': 'https://console.groq.com',
  'openai': 'https://platform.openai.com',
  'claude': 'https://claude.ai',
};

// Regex fallback for fast processing
function matchPatternHeuristic(text: string): FlowCommand | null {
  // 1. Clean up conversational padding and leaked wake words
  let lower = text.toLowerCase().trim();
  // Strip any accidental duplicate wake words that leaked into the command (e.g., "flo can you...")
  lower = lower.replace(/^(flow|flo|slow|glow|snow|low|lo)\s+/gi, '');
  lower = lower.replace(/^(can you|could you|would you|will you|please|just|like)\s+/gi, '');
  lower = lower.replace(/^(can you|could you|would you|will you|please|just|like)\s+/gi, ''); // Run twice in case of "can you please"
  lower = lower.replace(/\s+(please|thanks|thank you)$/gi, '');
  
  // Direct website without verb (e.g. "whatsapp web", "youtube", "linkedin")
  const bareTarget = lower.replace(/[.,!]+$/, '').trim();
  const directWeb = KNOWN_WEBSITES[bareTarget] || KNOWN_WEBSITES[bareTarget.replace(/\s+/g, '')];
  if (directWeb) {
    return { intent: 'browser_action', action: 'open_url', query: directWeb };
  }

  if (/^(open|launch|start|run)\s+(.+)/.test(lower)) {
    const match = lower.match(/^(open|launch|start|run)\s+(.+)/);
    const target = match![2].trim();
    
    // Check if this is a known website → route to browser_action
    const websiteUrl = KNOWN_WEBSITES[target];
    if (websiteUrl) {
      return { intent: 'browser_action', action: 'open_url', query: websiteUrl };
    }

    // Check if target looks like floatgpt/orb → route to floatgpt_control
    if (/^(floatgpt|float|orb)$/.test(target)) {
      return { intent: 'floatgpt_control', action: 'show_orb' };
    }

    // Direct native fast-path for Windows / macOS device settings
    if (/^(the\s+)?(device\s+|laptop\s+|windows\s+|mac\s+|macos\s+|system\s+)?settings(\s+(for|of)\s+(my\s+)?(laptop|device|pc|computer|mac))?\??$/i.test(target)) {
      const isMac = detectPlatform() === 'darwin';
      return { intent: 'os_action', action: 'open_app', appName: isMac ? 'System Settings' : 'ms-settings:' } as any;
    }

    // Let the Omnipotent OS Agent (Cloud Orchestrator) handle all local OS actions via tool calling
    return { intent: 'os_agent', action: 'open_app', appName: target };
  }
  
  // --- Direct WhatsApp Messaging Heuristic ---
  if (/\bwhatsapp\b/i.test(lower) && /\b(text|message|msg|send|write|tell|say|saying|dm)\b/i.test(lower)) {
    return { intent: 'os_agent', action: 'whatsapp_message', appName: 'whatsapp', query: text } as any;
  }
  const whatsappMatch = lower.match(/(?:in|on)\s+whatsapp\s+(?:can you\s+)?(?:please\s+)?(?:text|message|msg|send)\s+(.+)/i) || 
                        lower.match(/(?:text|message|msg|send)\s+(.+?)\s+(?:in|on)\s+whatsapp/i);
  if (whatsappMatch) {
    return { intent: 'os_agent', action: 'whatsapp_message', appName: 'whatsapp', query: whatsappMatch[1].trim() } as any;
  }

  if (/^(search|google|find)\s+(.+)/.test(lower)) {
    const match = lower.match(/^(search|google|find)\s+(.+)/);
    return { intent: 'browser_action', action: 'search_web', query: match![2].trim() };
  }
  
  if (/^(visit|go to|navigate to)\s+(.+)/.test(lower)) {
    const match = lower.match(/^(visit|go to|navigate to)\s+(.+)/);
    const target = match![2].trim();
    
    // Check if target is a known website (e.g. "go to youtube" or "go to gemini ai studio")
    const websiteUrl = KNOWN_WEBSITES[target];
    if (websiteUrl) {
      return { intent: 'browser_action', action: 'open_url', query: websiteUrl };
    }
    
    // Check if target is an explicit URL starting with http:// or https://, or a clean domain like 'github.com'
    if (/^https?:\/\/[^\s]+$/i.test(target) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|org|net|io|dev|ai|edu|gov|co|app|xyz)(\/[^\s]*)?$/i.test(target)) {
      return { intent: 'browser_action', action: 'open_url', query: target };
    }
    
    // If it's a compound instruction (e.g. "go to gemini ai studio and create an api key"), do NOT hijack it with open_url.
    // Return null so the Cloud AI / OS Agent handles the prompt with full reasoning.
    return null;
  }
  
  // Only intercept explicit local-plan questions — "today" / "task" in normal chat
  // used to skip the LLM and feel broken or slow-wrong.
  if (
    /\b(my (tasks?|goals?|schedule|agenda|habits?)|today'?s (tasks?|schedule|agenda)|pending (work|tasks?)|what('s| is) (on )?(my )?(plate|schedule|agenda)|momentum score)\b/i.test(lower)
    && !/\b(whatsapp|linkedin|email|send a |message )\b/i.test(lower)
  ) {
    let queryType: any = 'general';
    if (/task|to.?do/.test(lower)) queryType = 'today_tasks';
    else if (/pending|remaining/.test(lower)) queryType = 'pending_work';
    else if (/goal/.test(lower)) queryType = 'goals';
    else if (/schedule|agenda|calendar/.test(lower)) queryType = 'schedule';
    
    return { intent: 'memory_query', queryType, rawQuery: text };
  }
  
  if (/\b(orb|floatgpt|panel)\b/.test(lower)) {
    if (/hide|dismiss|close/.test(lower)) return { intent: 'floatgpt_control', action: 'hide_orb' };
    if (/show|bring|open/.test(lower)) return { intent: 'floatgpt_control', action: 'show_orb' };
  }

  return null;
}

export async function resolveCommandIntent(rawText: string): Promise<FlowCommand> {
  const text = resolveAlias(rawText.trim());
  const lower = text.toLowerCase().replace(/[?!.,]+$/, '').trim();

  // Cached dynamic import — first chat should not pay a full reload every time.
  try {
    const { MessengerAgent } = await loadMessengerAgent();
    if (MessengerAgent.hasPendingSession()) {
      const isEscapeOrCasual = /^(cancel|stop|abort|never\s*mind|exit|quit|back|hi|hello|hey|how are you|who are you|what can you do|good (morning|afternoon|evening))\b/i.test(lower);
      if (isEscapeOrCasual) {
        MessengerAgent.clearPendingSession();
      } else {
        return { intent: 'os_agent', action: 'whatsapp_message', appName: 'whatsapp', query: text } as any;
      }
    }
  } catch {}

  const regexCommand = matchPatternHeuristic(text);
  
  if (regexCommand) {
    console.log(`[Flow:Router] Regex matched:`, regexCommand);
    return regexCommand as FlowCommand;
  }
  
  return { intent: 'general_chat', message: text };
}

let messengerAgentImport: Promise<typeof import('../agents/messenger/core/MessengerAgent')> | null = null;
function loadMessengerAgent() {
  if (!messengerAgentImport) messengerAgentImport = import('../agents/messenger/core/MessengerAgent');
  return messengerAgentImport;
}

export async function routeCommand(rawText: string): Promise<FlowResponse> {
  const commandToExecute = await resolveCommandIntent(rawText);
  return await executeRoutedCommand(commandToExecute, rawText);
}

export async function executeRoutedCommand(command: FlowCommand, rawText: string): Promise<FlowResponse> {
  const config = getFlowConfig();

  switch (command.intent) {
    case 'memory_query': {
      // Memory answers should always be conversational so TTS can speak them
      const answer = queryMemory((command as any).queryType || 'general', rawText);
      return { success: true, message: answer, intent: 'memory_query', source: 'local' };
    }

    case 'os_action': {
      const state = useAppStore.getState().state;
      const fast = await tryFastRoute(rawText, state);
      if (fast.handled && fast.message) {
        return {
          success: true,
          message: fast.message,
          intent: 'os_action',
          source: 'local',
        };
      }
      const oCmd = command as any;
      const appName = oCmd.appName || oCmd.payload || '';
      const result = await executeOSAction({ type: 'open_app', payload: appName });
      return {
        success: result.success,
        message: result.message,
        intent: 'os_action',
        source: 'local',
      };
    }

    case 'os_agent': {
      try {
        const { MessengerAgent } = await import('../agents/messenger/core/MessengerAgent');
        if (MessengerAgent.hasPendingSession() || (command as any).action === 'whatsapp_message' || /\b(whatsapp|linkedin)\b/i.test(rawText)) {
          const mResult = await MessengerAgent.handleUserInstruction(rawText);
          if (mResult.handled) {
            return {
              success: true,
              message: mResult.message || '',
              intent: 'os_agent',
              source: 'local'
            };
          }
        }

        const state = useAppStore.getState().state;
        const fast = await tryFastRoute(rawText, state);
        if (fast.handled && fast.message) {
          return {
            success: true,
            message: fast.message,
            intent: 'os_agent',
            source: 'local'
          };
        }
        const answer = await generateAIResponse(state, rawText, undefined, undefined, { isOsAgent: true, skipHistory: false } as any);
        
        return { 
          success: true, 
          message: answer.message || 'I processed that as an OS request.', 
          intent: 'os_agent', 
          source: 'cloud' 
        };
      } catch (e) {
        console.error('[FlowRouter] OS Agent cloud execution failed:', e);
        return { 
          success: false, 
          message: 'To execute custom OS commands, please configure your AI API Key using the 🔑 icon in the top bar.', 
          intent: 'os_agent', 
          source: 'none' 
        };
      }
    }

    case 'browser_action': {
      const bCmd = command as any;
      const actionType = bCmd.action || 'search_web';
      const query = bCmd.query || '';
      const result2 = await executeOSAction({ type: actionType, payload: query });
      
      const verb = actionType === 'open_url' ? 'Navigating to' : 'Searching for';
      return { 
        success: result2.success, 
        message: result2.success ? `${verb} ${query}...` : `Sorry, I couldn't complete the browser action.`, 
        intent: 'browser_action', 
        source: 'local' 
      };
    }

    case 'floatgpt_control': {
      const action = (command as any).action || 'toggle_orb';
      const msgMap: Record<string, string> = {
        'show_orb': 'Showing FloatGPT.',
        'hide_orb': 'Hiding FloatGPT.',
        'toggle_orb': 'Toggling interface.'
      };
      return {
        success: true,
        message: msgMap[action] || `Executing ${action}.`,
        data: { action },
        intent: 'floatgpt_control',
        source: 'local',
      };
    }

    case 'general_chat':
    default: {
      try {
        const state = useAppStore.getState().state;
        const answer = await generateAIResponse(state, rawText);
        
        return { 
          success: true, 
          message: answer.message || 'I processed that in the cloud.', 
          intent: 'general_chat', 
          source: 'cloud' 
        };
      } catch (e) {
        console.error('[FlowRouter] Cloud AI execution failed:', e);
        return { 
          success: false, 
          message: 'Unable to generate response. Please check your API key settings or internet connection.', 
          intent: 'general_chat', 
          source: 'none' 
        };
      }
    }
  }
}
