/**
 * Legacy Compatibility Shim
 * 
 * All AI logic has been refactored into the modular src/ai/ directory:
 *   - src/ai/orchestrator.ts      — Central entry point
 *   - src/ai/providers/           — Provider adapters (Gemini, OpenAI, Groq, Anthropic)
 *   - src/ai/prompts/system.ts    — System prompt builder
 *   - src/ai/validation/          — Zod response parsing
 *   - src/ai/memory/              — Memory horizon filtering
 *   - src/ai/fallbacks/           — Retry + provider failover
 *   - src/ai/observability/       — Structured logging
 * 
 * This file re-exports generateAIResponse so that existing imports
 * (e.g., server.ts importing from './src/lib/ai') continue to work 
 * without any changes. Zero-regression guarantee.
 */

export { generateAIResponse } from '../ai';
