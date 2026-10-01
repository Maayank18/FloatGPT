import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs/promises";
import { generateAIResponse } from "./src/lib/ai";
import { LOCAL_MODEL_ID } from "./src/ai/providers/localModel";
import { resolveProviderKeyPool } from "./src/ai/config/keyPool";
import { z } from "zod";
import { mountAccountRoutes } from "./src/server/accountRoutes";
import { readInstallCounts, recordDownload, recordInstall } from "./api/_installStore.mjs";

dotenv.config();

const IntelligenceSchema = z.object({
  prompt: z.string().trim().min(1, 'Prompt is required and cannot be empty'),
  state: z.record(z.string(), z.any()).optional().default({}),
  isPlayground: z.boolean().optional().default(false)
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.FLOATGPT_PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));
  mountAccountRoutes(app);

  app.get('/api/stats/installs', async (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await readInstallCounts());
    } catch {
      res.status(503).json({ error: 'Install count is unavailable.' });
    }
  });

  app.post('/api/stats/download', async (req, res) => {
    try {
      const result = await recordDownload(req.body);
      res.setHeader('Cache-Control', 'no-store');
      if (result.status) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch {
      res.status(503).json({ error: 'Download count is unavailable.' });
    }
  });

  app.post('/api/stats/install', async (req, res) => {
    try {
      const result = await recordInstall(req.body);
      res.setHeader('Cache-Control', 'no-store');
      if (result.status) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch {
      res.status(503).json({ error: 'Install count is unavailable.' });
    }
  });

  // Strict CORS policy: Allow requests from local dev/desktop, Vercel, and Electron/no-origin clients
  const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'https://floatgpt.vercel.app'
  ];

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app')) {
      res.header("Access-Control-Allow-Origin", origin || "*");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  const STATE_FILE = path.join(process.cwd(), 'floatgpt_data.json');

  // Sync Endpoints (DEPRECATED: Now handled by Firebase Firestore)
  app.get("/api/state", async (req, res) => {
    res.status(410).json({ error: 'Endpoint Deprecated. Please update FloatGPT to sync with Firebase.' });
  });

  // Download Proxy Endpoint (Streams binary to client securely without CORS/redirect issues)
  // Dynamically resolves release tag from package.json
  let releaseTag = 'v2.2.0';
  try {
    const pkgRaw = await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgRaw);
    if (pkg.version) releaseTag = `v${pkg.version}`;
  } catch {}
  const GITHUB_RELEASE_BASE = `https://github.com/Maayank18/FloatGPT/releases/download/${releaseTag}`;

  app.get("/api/download/:os", async (req, res) => {
    try {
      const { os } = req.params;
      let url = "";
      let filename = "";

      if (os === "win") {
        const version = releaseTag.replace(/^v/, '');
        filename = `FloatGPT.Setup.${version}.exe`;
        url = `${GITHUB_RELEASE_BASE}/${filename}`;
      } else if (os === "mac") {
        filename = "FloatGPT-2.1.2-arm64.dmg";
        url = `https://github.com/Maayank18/FloatGPT/releases/download/v2.1.2/${filename}`;
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
    res.status(410).json({ error: 'Endpoint Deprecated. Please update FloatGPT to sync with Firebase.' });
  });


  // Unified Intelligence Endpoint
  app.post("/api/intelligence", async (req, res) => {
    try {
      const parseResult = IntelligenceSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.issues[0]?.message || "Invalid request payload" });
      }

      const { prompt, state: rawState, isPlayground } = parseResult.data;
      const state: any = { ...rawState };

      let overrideConfig = undefined;

      // If called from playground, use playgroundMessages as the active context and strictly enforce the developer Groq key
      if (isPlayground) {
          state.messages = state.playgroundMessages || [];
          const groqPool = resolveProviderKeyPool(
            'groq',
            process.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY
          );
          const fallbackKeys = groqPool.fallbackKeys;
          const primaryGroq = groqPool.primaryKey;
          
          const playgroundModel = state.settings?.aiConfig?.selectedModels?.active || 
                                  state.settings?.aiConfig?.selectedModels?.groq || 
                                  'openai/gpt-oss-120b';

          overrideConfig = primaryGroq
            ? {
                providerId: 'groq',
                model: playgroundModel,
                apiKey: primaryGroq,
                fallbackApiKeys: fallbackKeys,
                isSystemScope: true,
                isPlayground: true
              }
            : {
                providerId: 'ollama',
                model: LOCAL_MODEL_ID,
                apiKey: 'local',
                isSystemScope: true,
                isPlayground: true
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
      console.error(`Backend AI Error:`, error.message);
      return res.status(500).json({ error: error.message || "Failed to generate AI response." });
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

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
