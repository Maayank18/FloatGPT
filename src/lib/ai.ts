import { AppState } from '../types';
import { ZAIResponseSchema } from './schema';

/**
 * Strips down the state to only what the AI needs, reducing token usage.
 */
function getMinimalState(state: AppState) {
  return {
    goals: state.goals?.map((g) => ({ id: g.id, title: g.title, progress: g.progress, status: g.status })),
    projects: state.projects?.map((p) => ({ id: p.id, title: p.title, goalId: p.goalId, progress: p.progress, status: p.status })),
    tasks: state.tasks?.filter((t) => t.status !== 'Completed' && t.status !== 'Archived').map((t) => ({ id: t.id, title: t.title, projectId: t.projectId, status: t.status, priority: t.priority })),
    settings: state.settings,
    habitProfile: state.habitProfile,
    executionProfileSummary: state.executionProfile ? {
      planningAccuracy: state.executionProfile.planningAccuracyPercent + '%',
      averageDelay: state.executionProfile.averageDelayMinutes + ' min',
      preferredWorkingHours: state.executionProfile.preferredWorkingHours,
      preferredTaskSequence: state.executionProfile.preferredTaskSequence,
      frequentlyDelayedCategories: state.executionProfile.frequentlyDelayedCategories,
      averageFocusDuration: state.executionProfile.averageFocusDurationMinutes + ' min',
      mostProductiveWeekday: state.executionProfile.mostProductiveWeekday
    } : null
  };
}

/**
 * Builds the comprehensive system prompt for the autonomous execution loop.
 */
function buildSystemInstruction(state: AppState): string {
  const settings = state.settings;
  const minimalState = getMinimalState(state);
  const now = new Date();
  
  // Advanced precise time context for LLMs
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

  const basePersona = settings.aiConfig.systemPersona || 'You are FloatGPT, an autonomous AI Execution Copilot. Your job is to orchestrate a suite of specialized agents to help the user plan, prioritize, and complete work before deadlines are missed.';

  return `${basePersona}

CRITICAL TIME CONTEXT (ACCURACY REQUIRED):
The user's EXACT local time right now is: ${preciseLocalTime}
Current Day: ${currentDay}, Date: ${currentDate}
Current Local Time: ${currentHour}:${currentMinute.toString().padStart(2, '0')} (24-hour format)
Timezone Offset: UTC${tzString}

RULES FOR TIME MATH:
If the user asks to schedule something "in X hours/minutes", you MUST take the Current Local Time and explicitly perform the addition. 
Example: If the time is 18:32 and they say "in 1 hour", the deadline is exactly 19:32.
CRITICAL: Do NOT add extra buffer time for the "duration" of the event. The deadlineAt MUST match the exact offset requested.
When outputting dates, you MUST format them in ISO 8601 using the EXACT timezone offset provided above (e.g. YYYY-MM-DDTHH:mm:00${tzString}).

Current State: ${JSON.stringify(minimalState)}

Rules for Autonomous Execution Loop:
${settings?.features?.autoPlanSync ? `1. Smart Goal-To-Plan Engine (CRITICAL): When the user mentions a goal, task, deadline, meeting, or time-bound event, you MUST instantly trigger the full planning pipeline. Do NOT just create a Goal. You MUST output ALL of the following in your response:
   - Create exactly 1 Goal in 'newGoals' representing the high-level objective.
   - Create 2-4 Projects in 'newProjects' acting as milestones/phases for that Goal.
   - Create 3-5 Tasks in 'newTasks' inside those Projects representing actionable daily execution steps (include estimatedEffort, priority, and deadline).
   - Create at least 1 Risk in 'newRisks' identifying potential blockers.
   - Create at least 1 Recommendation in 'newRecommendations' identifying the Next Best Action.
   - Every Task MUST have a valid projectId, and every Project MUST have a valid goalId. Do not skip levels.` : `1. Auto Plan Sync is disabled. DO NOT automatically create tasks, goals, or projects.`}
2. Priority & Scheduling: Always estimate effort and assign priority for tasks. Determine the Next Best Action and output it as a recommendation.
3. Orphan Task Rule: If you create a Task, it MUST be attached to a Project. If the user asks for a simple task (like 'Buy groceries') and no suitable Project exists in the state, you MUST create a Goal (e.g., 'Errands') and a Project (e.g., 'General') for it.
4. Task Status: ALL new tasks MUST have status set to "Planned" or "Active". NEVER set status to "Inbox".
5. Adaptive Planning: If the user completes a task, recalculate the completion progress (0-100) of the parent Project and Goal. Adjust priorities, Next Actions, and risk scores automatically.
${settings?.features?.habitMemory ? `6. Habit Memory & User Pattern Learning: Update the user's Habit Profile (focusWindow, delayRisk, preferredSession, activeHours) based on what they say.` : `6. Habit Memory is disabled.`}
7. Personalized Recommendations: Generate actionable coaching instead of generic reminders. Always provide the next best action.
8. Focus / Overwhelm Mode: If the user says they are overwhelmed or want to focus, activate Focus Mode. Focus Mode is a calm execution state: hide clutter, return ONLY the top 3 critical task IDs and 1 calm coaching message to reduce visual noise. It is NOT a planner.
9. Background Recalculation: If the prompt starts with "[SYSTEM_EVENT]", the user did not say this. This is an automatic trigger. Do NOT reply with a visible message, just return an empty message string "" but include the updated state.
10. Time Agent (Critical): Output ALL dates and times (createdAt, updatedAt, deadlineAt, completedAt) as exact ISO 8601 datetime strings maintaining the user's local timezone offset (e.g., "YYYY-MM-DDTHH:mm:00${tzString}"). NEVER output raw millisecond integers, and NEVER store relative time strings.
11. Project Lifecycle: When a Goal or Project reaches 100% progress, its status MUST be set to "Completed" and completedAt MUST be set.
12. Adaptive Reflection Profiling: Look at the provided executionProfileSummary in the state. Use these insights to adapt your generated plans automatically. Do not mention that you are using this data unless asked.
13. Autonomous Recovery: Do NOT manually reschedule tasks yourself if the user asks for recovery. Just return a supportive message and the local engine will handle it.

Output your response in JSON matching this schema exactly. ALWAYS return a valid JSON object:
{
  "message": "A concise, calm reply or confirmation.",
  "newGoals": [{ "id": "uuid", "title": "...", "description": "...", "progress": 0, "createdAt": "2026-06-26T12:00:00Z", "status": "Active" }],
  "newProjects": [{ "id": "uuid", "goalId": "uuid", "title": "...", "description": "...", "progress": 0, "createdAt": "2026-06-26T12:00:00Z", "status": "Active" }],
  "newTasks": [{ "id": "uuid", "projectId": "uuid", "title": "...", "status": "Planned", "createdAt": "2026-06-26T12:00:00Z", "deadlineAt": "2026-06-26T18:00:00+05:30", "estimatedEffort": "1h", "priority": "High" }],
  "updatedTasks": [{ "id": "uuid", "status": "Completed" }],
  "newRisks": [{ "id": "uuid", "title": "...", "status": "Identified", "createdAt": "2026-06-26T12:00:00Z" }],
  "newResources": [{ "id": "uuid", "title": "...", "url": "...", "type": "...", "createdAt": "2026-06-26T12:00:00Z" }],
  "newRecommendations": [{ "id": "uuid", "message": "Coaching message", "type": "coaching", "createdAt": "2026-06-26T12:00:00Z" }],
  "habitProfileUpdate": { "focusWindow": "...", "delayRisk": "...", "preferredSession": "...", "activeHours": "..." },
  "focusModeUpdate": { "active": false, "coachingMessage": "...", "topTaskIds": [] }
}`;
}

export interface AIProvider {
  id: string;
  name: string;
  generate: (
    apiKey: string,
    model: string,
    systemInstruction: string,
    history: any[],
    prompt: string,
    temperature: number,
    maxTokens: number,
    isPlanMode: boolean,
    attachments?: any[],
    useWebSearch?: boolean
  ) => Promise<any>;
}

const ProviderRegistry: Record<string, AIProvider> = {
  google: {
    id: 'google',
    name: 'Google (Gemini)',
    generate: fetchGoogleGemini
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (GPT)',
    generate: (apiKey, model, systemInstruction, history, prompt, temperature, maxTokens, isPlanMode, attachments) =>
      fetchOpenAICompatible('https://api.openai.com/v1/chat/completions', apiKey, model, systemInstruction, history, prompt, temperature, maxTokens, isPlanMode, attachments)
  },
  groq: {
    id: 'groq',
    name: 'Groq (Llama / Mixtral)',
    generate: (apiKey, model, systemInstruction, history, prompt, temperature, maxTokens, isPlanMode, attachments) =>
      fetchOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', apiKey, model, systemInstruction, history, prompt, temperature, maxTokens, isPlanMode, attachments)
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    generate: fetchAnthropic
  }
};

/**
 * Main function to orchestrate the AI generation request.
 */
export async function generateAIResponse(
  state: AppState, 
  prompt: string, 
  attachments?: any[], 
  useWebSearch?: boolean,
  overrideConfig?: { providerId: string; model: string; apiKey: string; isSystemScope: boolean }
): Promise<any> {
  const config = state.settings.aiConfig;
  const providerId = overrideConfig ? overrideConfig.providerId : (config.selectedProvider || 'groq');
  let model = overrideConfig ? overrideConfig.model : (config.selectedModels?.[providerId as keyof typeof config.selectedModels] || 'llama-3.3-70b-versatile');
  const apiKey = overrideConfig ? overrideConfig.apiKey : config.apiKeys?.[providerId as keyof typeof config.apiKeys];

  // Self-healing legacy model aliases for users with cached deprecated models
  if (model === 'llama3-70b-8192') model = 'llama-3.3-70b-versatile';
  if (model === 'llama3-8b-8192') model = 'llama-3.1-8b-instant';

  const { temperature, maxTokens, contextWindow } = config.parameters;
  const isPlanMode = config.isPlanMode !== false; // Default to true
  const customChatContext = config.customChatContext || '';

  if (!apiKey || apiKey.trim() === '') {
    throw new Error(`API key missing for provider: ${providerId.toUpperCase()}. Please configure it in Settings.`);
  }

  const provider = ProviderRegistry[providerId];
  if (!provider) {
    throw new Error(`Unsupported AI Provider: ${providerId}`);
  }

  // Diagnostic logging during development
  console.log('--- AI Generation Request ---');
  console.log(`Scope: ${overrideConfig?.isSystemScope ? 'Playground System Mode' : 'Float Runtime (User Mode)'}`);
  console.log(`Key Namespace: ${overrideConfig?.isSystemScope ? 'playgroundSystemKey' : 'runtimeUserKey'}`);
  console.log(`Active Provider: ${provider.name}`);
  console.log(`Selected Model: ${model}`);
  console.log(`API Key Found: ${apiKey ? 'Yes' : 'No'}`);
  console.log('-----------------------------');

  let systemInstruction = '';
  if (isPlanMode) {
    systemInstruction = buildSystemInstruction(state);
  } else {
    systemInstruction = customChatContext.trim() !== '' 
      ? customChatContext 
      : (config.systemPersona || "You are a helpful, general-purpose daily problem solver and conversational assistant.");
  }

  // Filter messages based on Memory Horizon
  const memoryHorizonMs = (config.memoryHorizonDays || 7) * 24 * 60 * 60 * 1000;
  const horizonTimestamp = Date.now() - memoryHorizonMs;
  
  const relevantMessages = (state.messages || []).filter(m => m.timestamp >= horizonTimestamp);

  // Slice conversation history based on contextWindow (Token limit fallback)
  const recentHistory = relevantMessages.slice(-contextWindow).map(m => ({
    role: m.role,
    content: m.content,
    attachments: m.attachments
  }));

  try {
    return await provider.generate(
      apiKey, 
      model, 
      systemInstruction, 
      recentHistory, 
      prompt, 
      temperature, 
      maxTokens, 
      isPlanMode, 
      attachments, 
      useWebSearch
    );
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    throw new Error(error.message || "Failed to generate AI response.");
  }
}

async function fetchGoogleGemini(apiKey: string, model: string, systemInstruction: string, history: any[], prompt: string, temperature: number, maxTokens: number, isPlanMode: boolean, attachments?: any[], useWebSearch?: boolean) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const mapAttachments = (atts: any[]) => atts.map((att: any) => ({
    inlineData: {
      mimeType: att.mimeType,
      data: att.data.includes('base64,') ? att.data.split('base64,')[1] : att.data
    }
  }));

  const contents = history.map(h => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }, ...(h.attachments ? mapAttachments(h.attachments) : [])]
  }));
  contents.push({ role: 'user', parts: [{ text: prompt }, ...(attachments ? mapAttachments(attachments) : [])] });

  const payload: any = {
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      ...(isPlanMode ? { responseMimeType: "application/json" } : {})
    }
  };

  if (useWebSearch) {
    if (model.includes('2.5') || model.includes('3.0') || model.includes('3.5')) {
      payload.tools = [{ google_search: {} }];
    } else {
      payload.tools = [{ googleSearchRetrieval: { dynamicRetrievalConfig: { mode: "MODE_DYNAMIC", dynamicThreshold: 0.3 } } }];
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Google API Error: ${response.statusText}`);
  }

  const data = await response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No text returned from Gemini API");
  
  if (isPlanMode) {
    try {
      // Remove any markdown formatting if the model wrapped the JSON in ```json blocks
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const rawJson = JSON.parse(text);
      return ZAIResponseSchema.parse(rawJson);
    } catch (e) {
      console.error("Zod Validation Failed on Gemini output:", e);
      // Fallback gracefully instead of crashing
      return { message: "AI produced an invalid plan structure. Some tasks may not have been updated correctly." };
    }
  }

  return { message: text };
}

async function fetchOpenAICompatible(endpoint: string, apiKey: string, model: string, systemInstruction: string, history: any[], prompt: string, temperature: number, maxTokens: number, isPlanMode: boolean, attachments?: any[]) {
  const mapAttachments = (atts: any[]) => atts.map((att: any) => ({
    type: 'image_url',
    image_url: { url: att.data }
  }));

  const messages = [
    { role: 'system', content: systemInstruction },
    ...history.map(h => ({
      role: h.role,
      content: h.attachments ? [{ type: 'text', text: h.content }, ...mapAttachments(h.attachments)] : h.content
    })),
    { role: 'user', content: attachments && attachments.length > 0 ? [{ type: 'text', text: prompt }, ...mapAttachments(attachments)] : prompt }
  ];

  const payload = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(isPlanMode ? { response_format: { type: "json_object" } } : {})
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `API Error: ${response.statusText}`);
  }

  const data = await response.json();
  let text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("No text returned from API");

  if (isPlanMode) {
    try {
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const rawJson = JSON.parse(text);
      return ZAIResponseSchema.parse(rawJson);
    } catch (e) {
      console.error("Zod Validation Failed on OpenAI/Groq output:", e);
      return { message: "AI produced an invalid plan structure. Some tasks may not have been updated correctly." };
    }
  }

  return { message: text };
}

async function fetchAnthropic(apiKey: string, model: string, systemInstruction: string, history: any[], prompt: string, temperature: number, maxTokens: number, isPlanMode: boolean, attachments?: any[]) {
  const mapAttachments = (atts: any[]) => atts.map((att: any) => {
    const isBase64 = att.data.includes('base64,');
    const mediaType = att.mimeType || 'image/jpeg';
    const data = isBase64 ? att.data.split('base64,')[1] : att.data;
    
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: data
      }
    };
  });

  const messages = [
    ...history.map(h => {
      let content: any = [];
      if (h.content) content.push({ type: 'text', text: h.content });
      if (h.attachments && h.attachments.length > 0) {
        content = [...content, ...mapAttachments(h.attachments)];
      }
      return { role: h.role === 'assistant' ? 'assistant' : 'user', content };
    }),
    { 
      role: 'user', 
      content: attachments && attachments.length > 0 
        ? [{ type: 'text', text: prompt }, ...mapAttachments(attachments)] 
        : prompt 
    }
  ];

  // Anthropic API doesn't support JSON response format natively in the same way,
  // we instruct it strictly in the system prompt.
  const payload: any = {
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemInstruction,
    messages
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerously-allow-browser': 'true'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Anthropic API Error: ${response.statusText}`);
  }

  const data = await response.json();
  let text = data.content?.[0]?.text;
  if (!text) throw new Error("No text returned from Anthropic API");

  if (isPlanMode) {
    try {
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      // Sometimes models prepend explanatory text. Attempt to extract json object:
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        text = text.substring(jsonStart, jsonEnd + 1);
      }
      
      const rawJson = JSON.parse(text);
      return ZAIResponseSchema.parse(rawJson);
    } catch (e) {
      console.error("Zod Validation Failed on Anthropic output:", e, "Text:", text);
      return { message: "AI produced an invalid plan structure. Some tasks may not have been updated correctly." };
    }
  }

  return { message: text };
}
