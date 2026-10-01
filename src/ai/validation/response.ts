/**
 * AI Response Validation
 * Centralized Zod parsing + JSON extraction + auto-repair engine.
 * Eliminates duplicated validation logic across all provider adapters.
 */

import { ZAIResponseSchema, ZGoal, ZProject, ZTask, ZUpdatedTask, ZRisk, ZResource, ZRecommendation, ZHabitProfileUpdate, ZFocusModeUpdate } from '../../lib/schema';
import { AILogger } from '../observability/logger';

const GOAL_STATUS = new Set(['Active', 'Completed', 'Archived']);
const TASK_STATUS = new Set(['Inbox', 'Planned', 'Active', 'In Progress', 'Completed', 'Archived']);

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
}

function stamp(item: Record<string, any>): Record<string, any> {
  const now = Date.now();
  const id = typeof item.id === 'string' && item.id.trim() ? item.id : `id-${Math.random().toString(36).slice(2, 10)}`;
  const title = typeof item.title === 'string' && item.title.trim() ? item.title : 'Untitled';
  let progress = Number(item.progress);
  if (!Number.isFinite(progress)) progress = 0;
  progress = Math.max(0, Math.min(100, progress));
  return { ...item, id, title, progress, createdAt: item.createdAt || now };
}

/** Models often omit ids, dates, or use a status the schema does not allow. Repair those before validation so the plan is kept. */
function normalizePlanPayload(raw: any): any {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  for (const key of Object.keys(raw)) {
    if (raw[key] === null) delete raw[key];
  }
  if (typeof raw.message !== 'string') {
    raw.message = raw.message == null ? 'Here is the plan.' : String(raw.message);
  }

  const goals = Array.isArray(raw.newGoals) ? raw.newGoals.map(asRecord).filter((item): item is Record<string, unknown> => !!item) : null;
  if (goals) {
    raw.newGoals = goals.map((goal) => {
      const next = stamp(goal);
      next.status = GOAL_STATUS.has(String(goal.status)) ? goal.status : 'Active';
      return next;
    });
  }

  const firstGoalId = raw.newGoals?.[0]?.id || 'goal';
  const projects = Array.isArray(raw.newProjects) ? raw.newProjects.map(asRecord).filter((item): item is Record<string, unknown> => !!item) : null;
  if (projects) {
    raw.newProjects = projects.map((project) => {
      const next = stamp(project);
      next.goalId = typeof project.goalId === 'string' && project.goalId ? project.goalId : firstGoalId;
      next.status = GOAL_STATUS.has(String(project.status)) ? project.status : 'Active';
      return next;
    });
  }

  const firstProjectId = raw.newProjects?.[0]?.id || 'project';
  const tasks = Array.isArray(raw.newTasks) ? raw.newTasks.map(asRecord).filter((item): item is Record<string, unknown> => !!item) : null;
  if (tasks) {
    raw.newTasks = tasks.map((task) => {
      const next = stamp(task);
      next.projectId = typeof task.projectId === 'string' && task.projectId ? task.projectId : firstProjectId;
      next.status = TASK_STATUS.has(String(task.status)) ? task.status : 'Planned';
      return next;
    });
  }

  return raw;
}

function salvagePlan(raw: any): any | null {
  if (!raw || typeof raw !== 'object') return null;
  const message = typeof raw.message === 'string' ? raw.message : '';
  const salvaged: Record<string, any> = { message: message || 'Here is the plan.' };
  const pieces: Array<[string, { safeParse: (value: unknown) => { success: boolean; data?: any } }]> = [
    ['newGoals', ZGoal],
    ['newProjects', ZProject],
    ['newTasks', ZTask],
    ['updatedTasks', ZUpdatedTask],
    ['newRisks', ZRisk],
    ['newResources', ZResource],
    ['newRecommendations', ZRecommendation],
  ];
  let kept = false;
  for (const [key, schema] of pieces) {
    if (!Array.isArray(raw[key])) continue;
    const items = raw[key]
      .map((item: unknown) => schema.safeParse(item))
      .filter((result: { success: boolean }) => result.success)
      .map((result: { data?: any }) => result.data);
    if (items.length) {
      salvaged[key] = items;
      kept = true;
    }
  }
  const habit = ZHabitProfileUpdate.safeParse(raw.habitProfileUpdate);
  if (habit.success) salvaged.habitProfileUpdate = habit.data;
  const focus = ZFocusModeUpdate.safeParse(raw.focusModeUpdate);
  if (focus.success) salvaged.focusModeUpdate = focus.data;
  if (!kept && !message) return null;
  return salvaged;
}

/**
 * Attempts to repair truncated or slightly malformed JSON strings.
 */
function repairTruncatedJson(jsonStr: string): string {
  let repaired = jsonStr.trim();

  // If ends with a dangling key or unclosed string, close the string
  const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    repaired += '"';
  }

  // Count unclosed braces and brackets
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (char === '"' && (i === 0 || repaired[i - 1] !== '\\')) {
      inString = !inString;
    }
    if (!inString) {
      if (char === '{') openBraces++;
      else if (char === '}') openBraces--;
      else if (char === '[') openBrackets++;
      else if (char === ']') openBrackets--;
    }
  }

  // Remove trailing commas before closing
  repaired = repaired.replace(/,\s*$/, '');

  // Close unclosed arrays and objects
  while (openBrackets > 0) {
    repaired += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    repaired += '}';
    openBraces--;
  }

  return repaired;
}

/**
 * Parses raw LLM text output into a validated AIResponse object.
 * Handles markdown fences, explanatory preambles, and malformed JSON gracefully.
 */
export function parseStructuredResponse(rawText: string, providerName: string): any {
  if (!rawText || typeof rawText !== 'string') {
    return { message: "No response received from the AI model." };
  }

  try {
    // Step 1: Strip markdown code fences (```json ... ```)
    let cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Step 2: Extract JSON object if model prepended explanatory text
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1) {
      if (jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      } else {
        cleaned = cleaned.substring(jsonStart);
      }
    }

    // Step 3: Parse raw JSON with auto-repair fallback
    let rawJson: any;
    try {
      rawJson = JSON.parse(cleaned);
    } catch {
      // Attempt auto-repair on truncated JSON
      const repaired = repairTruncatedJson(cleaned);
      rawJson = JSON.parse(repaired);
    }

    // Step 4: Repair plan objects, then validate. A bad optional field must not throw the plan away.
    rawJson = normalizePlanPayload(rawJson);
    const parsed = ZAIResponseSchema.safeParse(rawJson);
    if (parsed.success) return parsed.data;
    const salvaged = salvagePlan(rawJson);
    if (salvaged && (salvaged.newGoals || salvaged.newProjects || salvaged.newTasks || salvaged.message)) {
      AILogger.logValidationFailure(providerName, rawText);
      return salvaged;
    }
    throw parsed.error;
  } catch (e) {
    AILogger.logValidationFailure(providerName, rawText);
    
    // Extract conversational message if JSON contains a "message" field
    const messageMatch = rawText.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (messageMatch && messageMatch[1]) {
      const extractedMessage = messageMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      return { message: extractedMessage };
    }

    // Graceful degradation: return safe response instead of crashing or showing raw JSON
    return {
      message: rawText.startsWith('{')
        ? "I processed your request, but the plan was partially truncated. Please send a quick follow-up to finalize all tasks."
        : rawText
    };
  }
}
