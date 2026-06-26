# FloatGPT 🚀

> **🚨 IMPORTANT: FloatGPT is NOT a website. ** 
> **FloatGPT is a persistent, autonomous AI Execution Companion that stays with you throughout your device workflow—not confined to a browser tab or a single application. It intelligently transforms scattered thoughts, goals, meetings, and deadlines into structured execution plans, continuously helping you plan, prioritize, adapt, recover from delays, and complete work before critical deadlines are missed.**

**FloatGPT is not just another to-do list.** It is a proactive, context-aware execution engine powered by Google's **Gemini AI**. It sits alongside your workflow, taking your messy thoughts, vague goals, and scattered deadlines, and autonomously structuring them into a clear, actionable, and mathematically prioritized plan. 

Built for high-performers, FloatGPT acts as a suite of invisible engines—Goal, Planning, Priority, Risk, Reflection, Recovery, and Explainability—integrated into a single, unified workspace.

---

## ✨ Why FloatGPT? (The Problem It Solves)

Traditional task managers are static. They require constant manual grooming, they don't understand context, and they leave you to figure out *what* to do next. When you fall behind, they just show a sea of red, inducing anxiety rather than helping you recover.

**FloatGPT changes this paradigm:**
- **It is proactive:** You chat with it, and it builds the plan for you.
- **It is self-healing:** If you miss a deadline, the **Recovery Engine** automatically reschedules non-critical tasks to protect your hard deadlines.
- **It is transparent:** The **Explainability Engine** tells you *exactly* why a task is prioritized right now.
- **It protects your attention:** **Focus Mode** strips away the noise and shows you the single most important action to take.

---

## 🧠 Core Intelligence Engines

FloatGPT is powered by a Unified Intelligence Copilot that acts as multiple specialized agents:

*   **Planning & Goal Agent**: Breaks down high-level, natural language objectives into structured Projects, Tasks, and milestones.
*   **Time & Guardian Engine**: Uses real-time, absolute Unix timestamps to drive a live countdown system. Visual urgency indicators (Safe -> Warning -> Critical -> Emergency -> Overdue) escalate automatically as deadlines approach.
*   **Autonomous Recovery Engine**: When you fall behind, the system intelligently defers "soft" tasks to tomorrow and highlights a critical path to get you back on track without overwhelming you.
*   **Transparent Explainability (The "Why?" Engine)**: Every prioritized task features an inline "Why?" button. Instead of generic text, it gives a precise 2-3 line explanation of its reasoning (e.g., *"This task is first because it is due in 42 minutes and blocks your next step."*) and an Execution Confidence score.
*   **Habit & Reflection Agent**: Analyzes your execution patterns to tailor your focus windows, adapting to your strongest productivity periods (Morning, Afternoon, Evening).

---

## 🖥️ What's Inside? (Features & UX)

*   **Mission Control (Home)**: Your centralized dashboard. It isolates time-critical tasks (due under 24 hours), separates strategic priorities, and flags active risks (e.g., "Missing API Key") before they become blockers.
*   **Deep Planning (Plan)**: Hierarchical progress rollup (Goals -> Projects -> Tasks). When you check off a task, progress bars dynamically recalculate across the entire tree.
*   **Focus Mode**: When overwhelmed, enter Focus Mode. It hides all navigation and project trees, surfacing *only* the top 3 most critical tasks and highlighting a single "Next Action" with calm, AI-generated coaching.
*   **Floating Assistant**: FloatGPT lives in a draggable, non-intrusive floating orb that expands into a full workspace, meaning it stays with you without taking over your screen.
*   **Local-First Speed**: Built on top of browser `localStorage` for zero-latency interactions. The state is sanitized and synchronized with every AI interaction.

---

## 🏗️ Architecture & Tech Stack

FloatGPT operates on a custom, highly-optimized full-stack setup:

**Frontend:**
*   **React 19** & **Vite**: Ultra-fast UI with modern React features.
*   **Tailwind CSS 4**: Sleek, deliberate, utility-first styling focusing on "Calm Execution" (no visual noise, highly readable).
*   **Framer Motion**: Smooth, purposeful layout animations and transitions.
*   **Floating UI**: Robust collision-aware popovers for the Explainability engine.

**Backend:**
*   **Node.js** & **Express**: Lightweight, robust backend server running Vite as middleware.
*   **Google GenAI SDK (`@google/genai`)**: Powers the unified intelligence endpoint with advanced prompting, executing the complex multi-agent logic and returning strictly typed JSON.
*   **ESBuild**: Compiles the backend into a standalone CommonJS bundle for seamless production deployment.

---

## 🚀 Setup Guide (For Judges & Evaluators)

Want to run FloatGPT locally? It takes less than 2 minutes. 

### Prerequisites
*   Node.js (v20+ recommended)
*   A Google Gemini API Key

### 1. Install & Configure
Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd floatgpt
npm install
```

Create your environment file:
```bash
cp .env.example .env
```
Open `.env` and add your actual Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Run the App
Start the development server (which boots both the Express backend and Vite frontend):
```bash
npm run dev
```
The app will be instantly available at **`http://localhost:3000`**.

### 3. How to Test (Demo Script)
1. **Chat**: Open FloatGPT and say, *"I have a hackathon submission due in 4 hours. I need to record a demo video, write the README, and deploy the app."*
2. **Watch it Plan**: Switch to the **Plan** tab to see how it structured your goal, assigned deadlines, and created tasks.
3. **Check the Logic**: Go to the **Home** tab. Click the **"Why?"** (Sparkles) button next to the top task to see the Explainability Engine's deterministic reasoning.
4. **Focus Mode**: Click the Focus target icon at the top right to see how the UI strips away noise to help you execute.
5. **Auto-Recovery**: Let a task's deadline pass, or tell the chat *"I'm falling behind."* Watch the system flag the task as overdue and automatically prioritize a recovery plan.

---

## 🎨 Design Philosophy: "Calm Execution"

FloatGPT is designed for high-stakes environments. 
- **No Tech-Larping**: No fake terminal logs, no unnecessary system coordinates. 
- **Intentional Attention**: Colors are muted by default. Vibrant warnings (Red/Orange) are reserved *strictly* for when a deadline genuinely requires immediate intervention. 
- **Clarity**: Spacing, margins, and typography (Inter & Space Grotesk) are deliberately paired to create visual hierarchy and reduce cognitive load.

---

## 📄 License

This project is open-source and intended for demonstration of agentic AI execution pipelines. Built to help you execute better.
