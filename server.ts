import express from "express";
import path from "path";

import dotenv from "dotenv";
import fs from "fs/promises";
import { generateAIResponse } from "./src/lib/ai";

dotenv.config();


async function startServer() {
  const app = express();
  const PORT = Number(process.env.FLOATGPT_PORT) || 3000;



  app.use(express.json({ limit: '50mb' }));

  // Add CORS headers for cross-origin requests from Playground to Server
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  const STATE_FILE = path.join(process.cwd(), 'floatgpt_data.json');

  // Sync Endpoints
  app.get("/api/state", async (req, res) => {
    try {
      const data = await fs.readFile(STATE_FILE, 'utf-8');
      res.json(JSON.parse(data));
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        res.json(null); // No state yet
      } else {
        res.status(500).json({ error: 'Failed to read state' });
      }
    }
  });

  // Download Proxy Endpoint (Streams binary to client securely without CORS/redirect issues)
  // Configurable release tag — change this single constant for version bumps
  const RELEASE_TAG = 'v1.0.0';
  const GITHUB_RELEASE_BASE = `https://github.com/Maayank18/FloatGPT/releases/download/${RELEASE_TAG}`;

  app.get("/api/download/:os", async (req, res) => {
    try {
      const { os } = req.params;
      let url = "";
      let filename = "";

      if (os === "win") {
        url = `${GITHUB_RELEASE_BASE}/FloatGPT_Windows.zip`;
        filename = "FloatGPT_Windows.zip";
      } else if (os === "mac") {
        url = `${GITHUB_RELEASE_BASE}/FloatGPT-1.0.0.dmg`;
        filename = "FloatGPT-1.0.0.dmg";
      } else {
        return res.status(400).json({ error: "Invalid OS. Use 'win' or 'mac'." });
      }

      console.log(`[Download] Proxying ${os} installer from ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
         throw new Error(`GitHub returned ${response.status}: ${response.statusText}. The release asset may not exist yet.`);
      }

      // Pass through Content-Length for download progress
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }

      // Ensure appropriate headers for binary stream
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/octet-stream");
      
      if (!response.body) {
        throw new Error("No response body received from GitHub");
      }

      // Stream the native fetch response body to Express res
      const { Readable } = require('stream');
      // @ts-ignore
      Readable.fromWeb(response.body).pipe(res);

    } catch (err: any) {
      console.error("[Download] Stream error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });


  app.post("/api/state", async (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
         return res.status(400).json({ error: "Invalid state body" });
      }
      
      // Atomic write to prevent file corruption during concurrent syncs
      const tmpFile = `${STATE_FILE}.tmp`;
      await fs.writeFile(tmpFile, JSON.stringify(req.body, null, 2), 'utf-8');
      await fs.rename(tmpFile, STATE_FILE);
      
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to write state:", err);
      res.status(500).json({ error: "Failed to write state" });
    }
  });


  // Unified Intelligence Endpoint
  app.post("/api/intelligence", async (req, res) => {
    try {
      const { prompt, state, isPlayground } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      let overrideConfig = undefined;

      // If called from playground, use playgroundMessages as the active context and strictly enforce the developer Groq key
      if (isPlayground) {
          state.messages = state.playgroundMessages || [];
          const systemGroqKey = process.env.GROQ_API_KEY;
          const fallbackKeys = [process.env.GROQ_API_KEY_2, process.env.GROQ_API_KEY_3].filter(Boolean) as string[];
          
          if (!systemGroqKey) {
             return res.status(500).json({ error: "System Error: Developer GROQ_API_KEY is missing from environment. Playground requires this to run." });
          }
          
          overrideConfig = {
              providerId: 'groq',
              model: 'llama-3.3-70b-versatile',
              apiKey: systemGroqKey,
              fallbackApiKeys: fallbackKeys,
              isSystemScope: true
          };
      }

      let parsed;
      let retries = 2;
      while (retries >= 0) {
          try {
              parsed = await generateAIResponse(state, prompt, undefined, false, overrideConfig);
              
              if (parsed.newGoals && parsed.newGoals.length > 0) {
                 if (!parsed.newProjects || parsed.newProjects.length === 0) throw new Error("Partial plan: newProjects missing. Regenerating...");
                 if (!parsed.newTasks || parsed.newTasks.length === 0) throw new Error("Partial plan: newTasks missing. Regenerating...");
              }
              break;
          } catch (err: any) {
              if (err.message?.includes('Partial plan') && retries > 0) {
                 retries--;
                 continue;
              }
              throw err;
          }
      }

      // Fix orphan tasks and wrong status
      if (parsed.newTasks && parsed.newTasks.length > 0) {
         let needsDefaultProject = false;
         for (const t of parsed.newTasks) {
            if (!['Planned', 'Active', 'In Progress', 'Completed'].includes(t.status)) {
               t.status = 'Planned';
            }
            
            const hasProjectInState = state.projects?.some((p: any) => p.id === t.projectId);
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
      
      return res.json(parsed);
      
    } catch (error: any) {
      console.log(`Backend AI Error:`, error.message);
      return res.json({ message: error.message || "Failed to generate AI response." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = __dirname;
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
