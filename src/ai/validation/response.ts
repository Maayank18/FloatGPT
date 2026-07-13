/**
 * AI Response Validation
 * Centralized Zod parsing + JSON extraction + output repair.
 * Eliminates duplicated validation logic across all provider adapters.
 */

import { ZAIResponseSchema } from '../../lib/schema';
import { AILogger } from '../observability/logger';

/**
 * Parses raw LLM text output into a validated AIResponse object.
 * Handles markdown fences, explanatory preambles, and malformed JSON gracefully.
 */
export function parseStructuredResponse(rawText: string, providerName: string): any {
  try {
    // Step 1: Strip markdown code fences (```json ... ```)
    let cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    // Step 2: Extract JSON object if model prepended explanatory text
    // (Common with Anthropic and some Gemini models)
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }

    // Step 3: Parse raw JSON
    const rawJson = JSON.parse(cleaned);

    // Step 4: Validate with Zod schema
    return ZAIResponseSchema.parse(rawJson);
  } catch (e) {
    AILogger.logValidationFailure(providerName, rawText);
    
    // Graceful degradation: return a safe response instead of crashing the app
    return {
      message: "I processed your request, but the response format was unexpected. Some updates may not have been applied correctly. Please try again."
    };
  }
}
