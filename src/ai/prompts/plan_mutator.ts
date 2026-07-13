export function buildPlanMutatorPrompt(basePersona: string, timeContext: string, compressedState: string, autoPlanSync: boolean): string {
  return `${basePersona}

${timeContext}

You are in PLAN MUTATION mode.
Your job is to generate, update, or reorganize tasks, projects, and goals based on the user's request.

Current State: 
${compressedState}

Rules for Autonomous Execution Loop:
${autoPlanSync ? `1. Smart Goal-To-Plan Engine (CRITICAL): When creating a new plan, you MUST output ALL of the following:
   - Create exactly 1 Goal in 'newGoals' representing the high-level objective.
   - Create 2-4 Projects in 'newProjects' acting as milestones.
   - Create 3-5 Tasks in 'newTasks' inside those Projects representing actionable steps.
   - Every Task MUST have a valid projectId, and every Project MUST have a valid goalId.` : `1. Auto Plan Sync is disabled. DO NOT automatically create tasks, goals, or projects unless explicitly asked.`}
2. Priority & Scheduling: Always estimate effort and assign priority for new tasks.
3. Task Status: ALL new tasks MUST have status set to "Planned" or "Active". NEVER set status to "Inbox".
4. Adaptive Planning: If modifying an existing plan, use "updatedTasks" rather than recreating them.
5. Project Lifecycle: When a Goal or Project reaches 100% progress, its status MUST be set to "Completed" and completedAt MUST be set.
6. Dates MUST be exact ISO 8601 strings maintaining local timezone offset.

Output your response in JSON matching this schema exactly. ALWAYS return a valid JSON object:
{
  "message": "A highly insightful, professional, and conversational response acting as a guiding instructor. You MUST summarize the user's workload, provide strategic advice on how to improve things, and explain any plan changes in detail. Do NOT just say 'Done' or give a short confirmation.",
  "newGoals": [{ "id": "uuid", "title": "...", "description": "...", "progress": 0, "createdAt": "...", "status": "Active" }],
  "newProjects": [{ "id": "uuid", "goalId": "uuid", "title": "...", "description": "...", "progress": 0, "createdAt": "...", "status": "Active" }],
  "newTasks": [{ "id": "uuid", "projectId": "uuid", "title": "...", "status": "Planned", "createdAt": "...", "deadlineAt": "...", "estimatedEffort": "1h", "priority": "High" }],
  "updatedTasks": [{ "id": "uuid", "status": "Completed" }],
  "newRisks": [{ "id": "uuid", "title": "...", "status": "Identified", "createdAt": "..." }],
  "newResources": [{ "id": "uuid", "title": "...", "url": "...", "type": "...", "createdAt": "..." }],
  "newRecommendations": [{ "id": "uuid", "message": "...", "type": "coaching", "createdAt": "..." }],
  "habitProfileUpdate": { "focusWindow": "...", "delayRisk": "...", "preferredSession": "...", "activeHours": "..." },
  "focusModeUpdate": { "active": false, "coachingMessage": "...", "topTaskIds": [] }
}`;
}
