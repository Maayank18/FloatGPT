require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// MongoDB connection
/*
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/floatgpt', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB connection error:', err));
*/

// Basic Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'FloatGPT Studio API' });
});

// Intelligence Route
app.post('/api/intelligence', async (req, res) => {
  try {
    const { prompt, state, isPlayground, workspaceMemory } = req.body;
    
    // 1. Get Provider and API Key
    const provider = state?.settings?.aiConfig?.selectedProvider || 'google';
    const apiKey = state?.settings?.aiConfig?.apiKeys?.[provider];
    
    if (!apiKey) {
      return res.status(400).json({ error: `API key not activated. Please set your API key for ${provider.toUpperCase()}.` });
    }

    // 2. Build Context using the new Memory Architecture
    
    // Use the workspace memory capsule if available
    let sharedMemoryContext = 'No shared memory capsule available.';
    if (workspaceMemory) {
      const activeGoalsText = (workspaceMemory.activeGoals || []).map(g => `- ${g.title}`).join('\n');
      const recentSummariesText = (workspaceMemory.recentSummaries || []).slice(-5).map(s => `[${s.source}] ${s.topic}: ${s.summary}`).join('\n');
      sharedMemoryContext = `Active Goals:\n${activeGoalsText || 'None'}\n\nRecent Shared Activity:\n${recentSummariesText || 'None'}\n\nExecution Status: ${workspaceMemory.executionStatus || 'Idle'}`;
    }

    // Extract recent Playground messages for local chat history ONLY (no Orb messages)
    const pgMessages = state?.playgroundMessages || [];
    const recentPgContext = pgMessages.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'Playground AI'}: ${m.content}`).join('\n');

    // 3. Construct System Prompt
    const systemPrompt = `You are the FloatGPT Web Playground AI. You operate independently from the FloatGPT Desktop Orb, but you share a Workspace Memory Capsule.
Your goal is to answer the user's prompt based on the Workspace Memory Capsule and your local chat history. Do not mention that you are an AI reading context blocks.

[WORKSPACE MEMORY CAPSULE]
${sharedMemoryContext}

[LOCAL PLAYGROUND CHAT HISTORY]
${recentPgContext || 'No recent Playground chat.'}

User's Latest Prompt: ${prompt}`;

    // 4. Call AI REST API based on provider
    let response;
    let aiMessage = "No response generated.";

    if (provider === 'google') {
      const model = state?.settings?.aiConfig?.selectedModels?.google || "gemini-1.5-flash";
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: systemPrompt }] }]
        })
      });
      if (response.ok) {
        const data = await response.json();
        aiMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || aiMessage;
      }
    } else if (provider === 'groq') {
      const model = state?.settings?.aiConfig?.selectedModels?.groq || "llama-3.1-70b-versatile";
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: systemPrompt }]
        })
      });
      if (response.ok) {
        const data = await response.json();
        aiMessage = data.choices?.[0]?.message?.content || aiMessage;
      }
    } else if (provider === 'openai') {
      const model = state?.settings?.aiConfig?.selectedModels?.openai || "gpt-4o";
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: systemPrompt }]
        })
      });
      if (response.ok) {
        const data = await response.json();
        aiMessage = data.choices?.[0]?.message?.content || aiMessage;
      }
    }

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : "Invalid provider";
      console.error(`${provider.toUpperCase()} API Error:`, errorText);
      return res.status(response ? response.status : 500).json({ error: `Error communicating with AI provider. API key might be invalid.` });
    }

    res.json({
      message: aiMessage,
      newTasks: []
    });
    
  } catch (error) {
    console.error("Intelligence API Error:", error);
    res.status(500).json({ error: "Failed to process intelligence request." });
  }
});

const fs = require('fs');
const path = require('path');

// Download Route for FloatGPT App
app.get('/api/download/:os', (req, res) => {
  const { os } = req.params;
  const releaseDir = path.join(__dirname, '../../release');
  
  try {
    if (!fs.existsSync(releaseDir)) {
      return res.status(404).send('Release directory not found. Please run the build script first.');
    }
    const files = fs.readdirSync(releaseDir);
    
    if (os === 'win') {
      const exeFile = files.find(f => f.endsWith('.exe') && !f.includes('blockmap'));
      if (exeFile) {
        return res.download(path.join(releaseDir, exeFile));
      }
      return res.status(404).send('Windows installer (.exe) not found.');
    } 
    
    if (os === 'mac') {
      const dmgFile = files.find(f => f.endsWith('.dmg') && !f.includes('blockmap'));
      if (dmgFile) {
        return res.download(path.join(releaseDir, dmgFile));
      }
      return res.status(404).send('MacOS installer (.dmg) not found.');
    }

    res.status(400).send('Invalid OS parameter');
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).send('Server error processing download request.');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
