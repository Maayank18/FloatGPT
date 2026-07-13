import { AppState } from '../../types';
import type { AIIntentMode } from '../router';
import { buildChatPrompt } from './chat';
import { buildPlanMutatorPrompt } from './plan_mutator';
import { buildPlanReviewerPrompt } from './plan_reviewer';

/**
 * Builds the exact time context string needed for time-aware models.
 */
function buildTimeContext(): string {
  const now = new Date();
  const localIsoString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 19);
  const timezoneOffset = -now.getTimezoneOffset(); // in minutes
  const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
  const offsetMins = Math.abs(timezoneOffset) % 60;
  const offsetSign = timezoneOffset >= 0 ? '+' : '-';
  const tzString = `${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMins.toString().padStart(2, '0')}`;
  
  const preciseLocalTime = `${localIsoString}${tzString}`;
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentDate = now.toLocaleDateString();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });

  return `CRITICAL TIME CONTEXT (ACCURACY REQUIRED):
The user's EXACT local time right now is: ${preciseLocalTime}
Current Day: ${currentDay}, Date: ${currentDate}
Current Local Time: ${currentHour}:${currentMinute.toString().padStart(2, '0')} (24-hour format)
Timezone Offset: UTC${tzString}

RULES FOR TIME MATH & SCHEDULING:
1. Explicit Offsets ("in 2 hours"): Take the Current Local Time and strictly perform the mathematical addition. Do NOT add extra buffer time.
2. Implicit Deadlines ("today", "tonight"): If requested for "today" without a specific time, default the deadlineAt to 23:59:00 local time today. If "tomorrow", default to 23:59:00 tomorrow.
3. Formatting: ALL output dates MUST be formatted in strict ISO 8601 using the EXACT timezone offset provided above (e.g. YYYY-MM-DDTHH:mm:00${tzString}). Never use 'Z' if the offset is not zero.`;
}

/**
 * Selects and builds the correct system instruction template based on the classified AI mode.
 */
export function buildSystemInstructionForMode(
  state: AppState, 
  mode: AIIntentMode, 
  compressedState: any, 
  customChatContext?: string
): string {
  const basePersona = state.settings.aiConfig.systemPersona || 'You are FloatGPT, an autonomous AI Execution Copilot.';
  const timeContext = buildTimeContext();
  const stateString = JSON.stringify(compressedState);
  const autoPlanSync = state.settings.features?.autoPlanSync ?? false;

  switch (mode) {
    case 'plan_create':
    case 'plan_update':
      return buildPlanMutatorPrompt(basePersona, timeContext, stateString, autoPlanSync);
    
    case 'plan_query':
      return buildPlanReviewerPrompt(basePersona, timeContext, stateString);
    
    case 'general_chat':
    case 'focus_mode':
    case 'summary':
    case 'explain_priority':
    default:
      if (customChatContext && customChatContext.trim() !== '') {
        return `${customChatContext}\n\nCurrent State: ${stateString}`;
      }
      return buildChatPrompt(basePersona, timeContext, stateString);
  }
}
