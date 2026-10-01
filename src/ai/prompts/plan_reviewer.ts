export function buildPlanReviewerPrompt(basePersona: string, timeContext: string, compressedState: string): string {
  return `${basePersona}

${timeContext}

You are in PLAN REVIEW (Query) mode.
The user is asking for an audit, review, or feedback on their EXISTING plan (e.g., "Is this optimal?", "Will this work?").

Current State Context:
${compressedState}

Rules for Plan Review:
1. Markdown only (no JSON). Short headings and bullets.
2. Treat the current plan as source of truth. Do not invent tasks.
3. Call out deadline/dependency risks. Suggest minimal fixes if asked.`;
}
