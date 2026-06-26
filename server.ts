import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  let supportedModels: string[] = [];
  try {
    console.log("Fetching supported Gemini models...");
    const modelsResult = await ai.models.list();
    for await (const m of modelsResult) {
      // m.name usually comes as "models/gemini-..."
      const modelName = m.name.replace('models/', '');
      supportedModels.push(modelName);
    }
    console.log("Supported Gemini models:", supportedModels.filter(m => m.includes('gemini')));
  } catch (error) {
    console.log("Failed to list models, falling back to default:", error);
    supportedModels = ["gemini-2.5-flash"];
  }

  function getAvailableModel(preferredModels: string[]): string {
    for (const model of preferredModels) {
      if (supportedModels.includes(model)) return model;
    }
    return supportedModels.includes("gemini-2.5-flash") ? "gemini-2.5-flash" : supportedModels[0];
  }

  app.use(express.json());

  // Unified Intelligence Endpoint
  app.post("/api/intelligence", async (req, res) => {
    try {
      const { prompt, state } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      // Quota-safe: send only minimal structured state to the model
      const minimalState = {
        goals: state.goals?.map((g: any) => ({ id: g.id, title: g.title, progress: g.progress, status: g.status })),
        projects: state.projects?.map((p: any) => ({ id: p.id, title: p.title, goalId: p.goalId, progress: p.progress, status: p.status })),
        tasks: state.tasks?.filter((t: any) => t.status !== 'completed').map((t: any) => ({ id: t.id, title: t.title, projectId: t.projectId, status: t.status, priority: t.priority })),
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

      // We ask Gemini to act as the unified FloatGPT brain and orchestrate updates to the user's state.
      const settings = state.settings;
      const now = new Date();
      const currentTimestamp = now.getTime();
      const currentIsoString = now.toISOString();
      const systemInstruction = `You are FloatGPT, an autonomous AI Execution Copilot. Your job is to orchestrate a suite of specialized agents (Goal, Planning, Scheduling, Priority, Risk, Habit, Recommendation, Reflection, Time) to help the user plan, prioritize, and complete work before deadlines are missed.

CRITICAL TIME CONTEXT:
The current exact time is ${currentIsoString} (Unix Timestamp: ${currentTimestamp}).
You MUST use this timestamp as the base for ALL relative time calculations (e.g. "in 15 minutes", "tomorrow").

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
7. Personalized Recommendations: Generate actionable coaching (e.g., "This task is too large. Split it into 3 milestones.") instead of generic reminders. Always provide the next best action.
8. Focus / Overwhelm Mode: If the user says they are overwhelmed or want to focus, activate Focus Mode. Focus Mode is a calm execution state: hide clutter, return ONLY the top 3 critical task IDs and 1 calm coaching message to reduce visual noise. It is NOT a planner.
9. Background Recalculation: If the prompt starts with "[SYSTEM_EVENT]", the user did not say this. This is an automatic trigger (e.g., a task was checked off). Do NOT reply with a visible message, just return an empty message string "" but include the updated state (progress percentages, risks, next actions).
10. Time Agent (Critical): EVERY Task MUST track createdAt, updatedAt, deadlineAt, and completedAt as absolute Unix timestamps in milliseconds. 
    - NEVER store relative time strings (like "15 minutes" or "Overdue by 2 hours") in any field.
    - If a relative time is mentioned (e.g., "in 15 minutes"), compute the exact absolute Unix timestamp based on ${currentTimestamp} and save it as deadlineAt.
    - If the time is ambiguous, ask ONE short clarification instead of guessing (e.g. "Do you mean 15 minutes from now or 3 PM?").
11. Project Lifecycle: When a Goal or Project reaches 100% progress, its status MUST be set to "Completed" and completedAt MUST be set. If requested to archive, set status to "Archived".
12. Adaptive Reflection Profiling: Look at the provided executionProfileSummary in the state. Use these insights (e.g., planningAccuracy, mostProductiveWeekday, preferredWorkingHours, frequentlyDelayedCategories) to adapt your generated plans and estimates automatically. Do not mention that you are using this data unless asked.
13. Autonomous Recovery: The client application has a deterministic local 'Recovery Engine' that automatically postpones overdue tasks and resolves scheduling conflicts. If the user asks for help because they are behind (e.g. "Recover my plan", "I missed my deadline", "Rebuild today"), DO NOT manually reschedule tasks or modify deadlines yourself. Instead, just return a supportive, calm message like "I've rebuilt today's schedule. Here's the fastest path back on track." and the local engine will handle the deterministic rescheduling.

Output your response in JSON matching this schema:
{
  "message": "A concise, calm reply or confirmation.",
  "newGoals": [...],
  "newProjects": [...],
  "newTasks": [...],
  "updatedTasks": [...],
  "newRisks": [...],
  "newResources": [...],
  "newRecommendations": [
    { "id": "uuid", "message": "Coaching message", "type": "coaching" | "warning" | "suggestion", "createdAt": 123 }
  ],
  "habitProfileUpdate": {
    "focusWindow": "string",
    "delayRisk": "string",
    "preferredSession": "string",
    "activeHours": "string"
  },
  "focusModeUpdate": {
    "active": boolean,
    "coachingMessage": "string",
    "topTaskIds": ["id1", "id2"]
  }
}

Only include items if the user's prompt necessitates adding them. Make IDs unique strings. Do not ask for confirmation—do the work autonomously. If generating a plan, ensure newGoals, newProjects, newTasks, newRisks, and newRecommendations are all populated so the UI does not show empty states.`;

      let response;
      let retries = 2; // Max 2 retries
      let delay = 1000 + Math.random() * 500; // Exponential backoff with jitter
      
      const fallbackChain = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"]
         .filter(m => supportedModels.includes(m));
         
      if (fallbackChain.length === 0) {
          fallbackChain.push("gemini-2.5-flash"); // ultimate fallback
      }
      
      let currentModelIndex = 0;
      let currentModel = fallbackChain[currentModelIndex];
      let lastError = null;

      while (retries >= 0) {
        try {
          response = await ai.models.generateContent({
            model: currentModel,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  message: { type: Type.STRING },
                  newGoals: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        progress: { type: Type.NUMBER },
                        deadlineAt: { type: Type.NUMBER },
                        createdAt: { type: Type.NUMBER },
                        updatedAt: { type: Type.NUMBER },
                        completedAt: { type: Type.NUMBER },
                        status: { type: Type.STRING }
                      },
                      required: ["id", "title", "description", "progress", "createdAt"]
                    }
                  },
                  newProjects: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        goalId: { type: Type.STRING },
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        progress: { type: Type.NUMBER },
                        deadlineAt: { type: Type.NUMBER },
                        createdAt: { type: Type.NUMBER },
                        updatedAt: { type: Type.NUMBER },
                        completedAt: { type: Type.NUMBER },
                        status: { type: Type.STRING }
                      },
                      required: ["id", "goalId", "title", "description", "progress", "createdAt"]
                    }
                  },
                  newTasks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        projectId: { type: Type.STRING },
                        title: { type: Type.STRING },
                        status: { type: Type.STRING },
                        deadlineAt: { type: Type.NUMBER },
                        estimatedEffort: { type: Type.STRING },
                        priority: { type: Type.STRING },
                        createdAt: { type: Type.NUMBER },
                        updatedAt: { type: Type.NUMBER },
                        completedAt: { type: Type.NUMBER }
                      },
                      required: ["id", "projectId", "title", "status", "createdAt"]
                    }
                  },
                  updatedTasks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        status: { type: Type.STRING }
                      },
                      required: ["id", "status"]
                    }
                  },
                  newRisks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        title: { type: Type.STRING },
                        status: { type: Type.STRING },
                        createdAt: { type: Type.NUMBER }
                      },
                      required: ["id", "title", "status", "createdAt"]
                    }
                  },
                  newResources: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        title: { type: Type.STRING },
                        url: { type: Type.STRING },
                        type: { type: Type.STRING },
                        createdAt: { type: Type.NUMBER }
                      },
                      required: ["id", "title", "url", "type", "createdAt"]
                    }
                  },
                  newRecommendations: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        message: { type: Type.STRING },
                        type: { type: Type.STRING },
                        createdAt: { type: Type.NUMBER }
                      },
                      required: ["id", "message", "type", "createdAt"]
                    }
                  },
                  habitProfileUpdate: {
                    type: Type.OBJECT,
                    properties: {
                      focusWindow: { type: Type.STRING },
                      delayRisk: { type: Type.STRING },
                      preferredSession: { type: Type.STRING },
                      activeHours: { type: Type.STRING }
                    }
                  },
                  focusModeUpdate: {
                    type: Type.OBJECT,
                    properties: {
                      active: { type: Type.BOOLEAN },
                      coachingMessage: { type: Type.STRING },
                      topTaskIds: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                      }
                    }
                  }
                },
                required: ["message"]
              }
            }
          });
          
          if (!response || !response.text) {
             throw new Error("No text returned from Gemini");
          }
          
          const text = response.text;
          const parsed = JSON.parse(text);
          console.log("Structured payload generated:", JSON.stringify(parsed, null, 2));
          
          // Validation: If it generated a goal but no projects or tasks, it's a partial plan.
          if (parsed.newGoals && parsed.newGoals.length > 0) {
             if (!parsed.newProjects || parsed.newProjects.length === 0) {
                throw new Error("Partial plan: newProjects missing. Regenerating...");
             }
             if (!parsed.newTasks || parsed.newTasks.length === 0) {
                throw new Error("Partial plan: newTasks missing. Regenerating...");
             }
          }
          
          // Fix orphan tasks and wrong status
          if (parsed.newTasks && parsed.newTasks.length > 0) {
             let needsDefaultProject = false;
             for (const t of parsed.newTasks) {
                if (!['Planned', 'Active', 'In Progress', 'Completed'].includes(t.status)) {
                   t.status = 'Planned';
                }
                
                const hasProjectInState = minimalState.projects?.some((p: any) => p.id === t.projectId);
                const hasProjectInNew = parsed.newProjects?.some((p: any) => p.id === t.projectId);
                if (!hasProjectInState && !hasProjectInNew) {
                   needsDefaultProject = true;
                   t.projectId = 'proj_default_misc';
                }
             }
             
             if (needsDefaultProject) {
                if (!parsed.newGoals) parsed.newGoals = [];
                if (!parsed.newProjects) parsed.newProjects = [];
                
                if (!parsed.newGoals.some((g: any) => g.id === 'goal_default_misc')) {
                   parsed.newGoals.push({
                      id: 'goal_default_misc',
                      title: 'General Tasks',
                      description: 'Miscellaneous uncategorized tasks',
                      progress: 0,
                      createdAt: Date.now(),
                      status: 'Active'
                   });
                }
                
                if (!parsed.newProjects.some((p: any) => p.id === 'proj_default_misc')) {
                   parsed.newProjects.push({
                      id: 'proj_default_misc',
                      goalId: 'goal_default_misc',
                      title: 'Miscellaneous',
                      description: 'General daily tasks',
                      progress: 0,
                      createdAt: Date.now(),
                      status: 'Active'
                   });
                }
             }
          }
          
          return res.json(parsed); // Success, exit completely
          
        } catch (error: any) {
          console.log(`Gemini API Error (model: ${currentModel}):`, error.message);
          lastError = error;
          
          if (error.message?.includes('Partial plan')) {
             if (retries === 0) {
                // If we ran out of retries, just return what we have or a failure message
                return res.json({ message: "Failed to generate a complete plan. Please try again." });
             }
             retries--;
             console.log("Retrying due to partial plan...");
             continue; // Retry with same model
          }
          
          if (error.message?.includes('429') || error.status === 429 || error.message?.includes('RESOURCE_EXHAUSTED')) {
             return res.json({ 
                message: "Quota limit reached, showing cached or fallback response. Please wait a moment and try again." 
             });
          }
          
          if (error.message?.includes('404') || error.status === 404 || error.message?.includes('NOT_FOUND')) {
             if (currentModelIndex < fallbackChain.length - 1) {
                currentModelIndex++;
                currentModel = fallbackChain[currentModelIndex];
                console.log(`Falling back to ${currentModel} due to 404...`);
                continue; // try next immediately
             } else {
                return res.json({ 
                   message: "This model is unavailable, please switch project/billing or try later." 
                });
             }
          }
          
          // 503 / UNAVAILABLE / fetch failed
          if (retries === 0) {
             return res.json({ 
                message: "Model temporarily busy. Please try again in a few moments." 
             });
          }
          
          retries--;
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = delay * 2 + Math.random() * 500;
          
          // Shift to fallback if available
          if (currentModelIndex < fallbackChain.length - 1) {
             currentModelIndex++;
             currentModel = fallbackChain[currentModelIndex];
             console.log(`Falling back to ${currentModel} due to transient error...`);
          }
        }
      }

    } catch (error: any) {
      console.log("Intelligence error:", error);
      res.json({ message: "An unexpected error occurred. Please try again later." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
