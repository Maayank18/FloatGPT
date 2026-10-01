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
const CREATE_PLAN_REGEX = /\b(create|make|generate|build|set up|prepare|schedule|organize|give me|design|draft)\b.*?\b(plan|roadmap|schedule|todos?|milestones?|goals?|interview|prep|study|routine|sprint|tasks?)\b/i;
const UPDATE_PLAN_REGEX = /\b(add|update|reschedule|mark|complete|finish|defer|rename|move|push)\b.{0,40}\b(task|goal|project|deadline|todo)\b/i;
const QUERY_PLAN_REGEX = /\b(review my plan|is this optimal|what are the risks|how is my plan)\b/i;

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
  if (SUMMARY_REGEX.test(prompt)) return 'summary';
  if (EXPLAIN_REGEX.test(prompt)) return 'explain_priority';
  if (FOCUS_REGEX.test(prompt)) return 'focus_mode';

  if (!isPlanModeToggle) {
    return 'general_chat';
  }

  if (CREATE_PLAN_REGEX.test(prompt)) return 'plan_create';
  if (UPDATE_PLAN_REGEX.test(prompt)) return 'plan_update';
  if (QUERY_PLAN_REGEX.test(prompt)) return 'plan_query';
  return 'general_chat';
}
