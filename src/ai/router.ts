import type { AIProvider, GenerationArgs } from './providers/types';

export type AIIntentMode = 
  | 'plan_create' 
  | 'plan_update' 
  | 'plan_query' 
  | 'summary' 
  | 'explain_priority' 
  | 'general_chat' 
  | 'focus_mode';

const SUMMARY_REGEX = /remaining (task|work)|any task(s)? left|what.*pending|what.*remain(s)?|what.*still do|what.*left|what.*task|what.*routine|my schedule/i;
const EXPLAIN_REGEX = /why this(\?)?$|why is this first(\?)?$|why should i do this(\?)?$|explain (this|my current focus)(\?)?|how to improve|analysis|insights/i;
const FOCUS_REGEX = /overwhelmed|too much to do|focus mode|help me focus|distracted/i;
const UPDATE_PLAN_REGEX = /\b(add|update|reschedule|mark|complete|finish|defer|rename|move|push)\b.{0,40}\b(task|goal|project|deadline|todo)\b/i;

/**
 * Zero-token intent routing. An extra LLM hop here doubled chat latency
 * and burned rate-limit quota before the real answer.
 */
export async function classifyIntent(
  prompt: string, 
  isPlanModeToggle: boolean,
  _provider?: AIProvider,
  _args?: Partial<GenerationArgs>
): Promise<AIIntentMode> {
  if (!isPlanModeToggle) {
    if (SUMMARY_REGEX.test(prompt)) return 'summary';
    if (EXPLAIN_REGEX.test(prompt)) return 'explain_priority';
    if (FOCUS_REGEX.test(prompt)) return 'focus_mode';
    return 'general_chat';
  }

  // The toggle is the mode. Every message writes or updates the plan.
  // Questions, follow-ups, and "just chatting" do not fall through to chat.
  if (UPDATE_PLAN_REGEX.test(prompt)) return 'plan_update';
  return 'plan_create';
}
