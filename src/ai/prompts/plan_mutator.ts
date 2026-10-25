export function buildPlanMutatorPrompt(basePersona: string, timeContext: string, compressedState: string, autoPlanSync: boolean): string {
  return `${basePersona}

${timeContext}

You are writing the Plan tab. That is the only place this goes.
Never run the computer. Never output execute_os_command, PowerShell, AppleScript, or a calendar script.
${autoPlanSync ? 'Auto plan sync is on: a clear request is written to the plan now.' : 'Plan mode is on: write the plan they just asked for.'}

Current plan:
${compressedState}

How to write it:
- You are not chatting. Never give advice, a list in prose, or a question back. The plan JSON is the whole reply.
- One goal, titled in their words.
- One project with that same title, and its goalId set to the goal.
- A meeting is these four tasks, in this order: "Check the time is free", "Write the notes", "Get the brochure or deck ready", then the meeting under its real name. Only the meeting task gets deadlineAt.
- Anything that is not a meeting is still a plan: one goal and the real next tasks they would do, not a single vague line and not a consulting roadmap.
- Put the time they gave on deadlineAt, as ISO 8601 with the local offset above. If they said remotely, on a call, or a place, put that in the meeting task title.
- If they named the day but not the hour, still write the plan and use 23:59 local that day. Say that in message so they can correct it.
- If this plan already has that item, send the same ids again with the new deadlineAt. Do not add a second copy.
- Do not mark anything Completed.
- message is one or two plain sentences: what you put on the plan, and the time. No greeting.

Return JSON only:
{
  "message": "Meeting with Wispr Flow is on the plan for tomorrow at 5:00 pm. First check the time, then the notes, then what you will show.",
  "newGoals": [{ "id": "g1", "title": "Meeting with Wispr Flow", "description": "", "progress": 0, "createdAt": 0, "status": "Active" }],
  "newProjects": [{ "id": "p1", "goalId": "g1", "title": "Meeting with Wispr Flow", "description": "", "progress": 0, "createdAt": 0, "status": "Active" }],
  "newTasks": [
    { "id": "t1", "projectId": "p1", "title": "Check the time is free", "status": "Planned", "createdAt": 0, "priority": "Normal" },
    { "id": "t2", "projectId": "p1", "title": "Write the notes", "status": "Planned", "createdAt": 0, "priority": "Normal" },
    { "id": "t3", "projectId": "p1", "title": "Get the brochure or deck ready", "status": "Planned", "createdAt": 0, "priority": "Normal" },
    { "id": "t4", "projectId": "p1", "title": "Meeting with Wispr Flow, remotely", "status": "Planned", "createdAt": 0, "deadlineAt": "YYYY-MM-DDTHH:mm:00+05:30", "priority": "Normal" }
  ]
}`;
}
