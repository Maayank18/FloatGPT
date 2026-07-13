import type { AIProvider, GenerationArgs } from './providers/types';
import { executeWithFallback } from './fallbacks/retry';

export type AIIntentMode = 
  | 'plan_create' 
  | 'plan_update' 
  | 'plan_query' 
  | 'summary' 
  | 'explain_priority' 
  | 'general_chat' 
  | 'focus_mode';

const SUMMARY_REGEX = /remaining (task|work)|any task(s)? left|what.*pending|what.*remain(s)?|what.*still do|what.*left|what.*task|what.*plan|what.*routine|my schedule/i;
const EXPLAIN_REGEX = /why this(\?)?$|why is this first(\?)?$|why should i do this(\?)?$|explain (this|my current focus)(\?)?|how to improve|analysis|insights/i;
const FOCUS_REGEX = /overwhelmed|too much to do|focus mode|help me focus|distracted/i;

/**
 * Determines the precise AI intent mode based on the user's prompt and the UI toggle.
 * 
 * @param prompt The user's input
 * @param isPlanModeToggle The state of the UI toggle (true = Execution Agent, false = Chat)
 * @param provider The AI provider to use for complex routing
 * @param args Base arguments (apiKey, model) for the router LLM call
 * @returns The classified internal mode
 */
export async function classifyIntent(
  prompt: string, 
  isPlanModeToggle: boolean,
  provider: AIProvider,
  args: Partial<GenerationArgs>
): Promise<AIIntentMode> {
  // 1. Fast-Path Deterministic Routing (Regex)
  if (SUMMARY_REGEX.test(prompt)) return 'summary';
  if (EXPLAIN_REGEX.test(prompt)) return 'explain_priority';
  
  // If the user explicitly turned OFF plan mode, we force general_chat,
  // unless they are asking for focus mode help.
  if (!isPlanModeToggle) {
    if (FOCUS_REGEX.test(prompt)) return 'focus_mode';
    return 'general_chat';
  }

  // 2. LLM-Based Routing for Plan Mode (Differentiating Create vs Update vs Query)
  const systemPrompt = `You are a strict intent router for FloatGPT.
Classify the user's prompt into EXACTLY one of these four categories:
1. "plan_create" - The user wants to create a brand new goal, project, or set of tasks from scratch.
2. "plan_update" - The user wants to modify, reschedule, or add to an EXISTING plan or task.
3. "plan_query" - The user is asking a question ABOUT a plan (e.g., "Is this optimal?", "Review my plan", "What are the risks?"). No changes requested.
4. "focus_mode" - The user is overwhelmed and needs to focus on a few things.

Output ONLY the category name. No other text.`;

  try {
    const response = await executeWithFallback(
      provider,
      [],
      {
        apiKey: args.apiKey!,
        model: args.model!,
        systemInstruction: systemPrompt,
        history: [], // No history needed for routing
        prompt: prompt,
        temperature: 0, // Deterministic
        maxTokens: 10,  // Fast and cheap
        isPlanMode: false
      },
      1 // Fast fail
    );
    
    const intent = response?.message?.trim().toLowerCase();
    
    if (intent === 'plan_create') return 'plan_create';
    if (intent === 'plan_update') return 'plan_update';
    if (intent === 'plan_query') return 'plan_query';
    if (intent === 'focus_mode') return 'focus_mode';
    
    // Default fallback if the router hallucinates
    return 'plan_update';
  } catch (err) {
    // If routing fails (e.g. network timeout), fallback to a safe default
    console.warn("[Router] LLM classification failed, falling back to plan_update", err);
    return 'plan_update';
  }
}
