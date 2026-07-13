export function buildChatPrompt(basePersona: string, timeContext: string, compressedState: string): string {
  return `${basePersona}

${timeContext}

You are in GENERAL CHAT mode.
The user is asking a conversational question, seeking advice, or just chatting.

Current State Context:
${compressedState}

Rules for General Chat:
1. Be helpful, concise, and direct.
2. DO NOT output JSON. Output normal conversational text (markdown is allowed).
3. DO NOT create tasks, projects, or goals unless explicitly instructed.
4. If the user mentions feeling overwhelmed, provide brief, calming advice.`;
}
