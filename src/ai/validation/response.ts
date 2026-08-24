/**
 * AI Response Validation
 * Centralized Zod parsing + JSON extraction + auto-repair engine.
 * Eliminates duplicated validation logic across all provider adapters.
 */

import { ZAIResponseSchema } from '../../lib/schema';
import { AILogger } from '../observability/logger';

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

    // Step 4: Validate with Zod schema
    return ZAIResponseSchema.parse(rawJson);
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
