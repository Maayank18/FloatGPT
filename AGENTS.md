# FloatGPT AI Agent Guidelines

This file (`AGENTS.md`) serves as the core instruction manual for any AI agents or LLM-based coding assistants operating within the FloatGPT workspace. 

When generating code, analyzing the project, or providing architectural recommendations, AI agents must adhere to the following principles:

## 1. Architectural Integrity

* **Strict Isolation**: FloatGPT relies on a strict separation between the Electron Desktop app (the "Orb") and the Playground Studio (the Web Dashboard). Never mix their states directly; always use the `SyncBridge` for cross-surface communication.
* **Local-First Priority**: Always prioritize `idb-keyval` for fast local reads/writes before failing over or syncing to Firebase.
* **Memory Layering**: Transcripts from the Playground must *never* overwrite transcripts from the Orb. They share a Memory Layer but maintain independent conversation histories.

## 2. Agentic Tooling & Security

* **Omnipotent OS Agent**: The Cloud AI (Gemini/OpenAI/Groq) now serves as the primary OS orchestrator, generating raw PowerShell scripts on-the-fly to execute OS commands (e.g., opening UWP apps, manipulating volume) via `window.electronAPI.flow.executeScript`.
* **Guardrails**: Destructive PowerShell commands (e.g., `Remove-Item`, `del`, `format`) are strictly intercepted and blocked by the `orchestrator.ts` safety layer. The user is prompted to execute them manually if required.
* **Digital Guardian (Focus Enforcer)**: FloatGPT uses an active background Windows polling service (`electron/guardian.cjs`) to monitor active window titles against a blocklist. Upon violation, the `FloatingAssistant.tsx` aggressively overrides Framer Motion bounds (shaking/red pulsating) to drag attention back to execution.

## 3. UI/UX & Styling Standards

* **Aesthetic Focus**: FloatGPT is designed for "Calm Execution". Use muted backgrounds (`bg-bg`, `bg-panel`, `bg-card`) with high-contrast text (`text-text-primary`).
* **Animations**: All micro-interactions and layout changes should use `framer-motion` for smooth, physics-based transitions. Never use abrupt DOM removals without an exit animation.
* **Color Usage**: Reserve bright, attention-grabbing colors (Red/Orange/Accent) *strictly* for high-priority warnings, critical deadlines, or primary calls to action. The Red Pulsating Orb is exclusively reserved for Digital Guardian violations and Extreme Deadlines.

## 4. Technology Stack

* **Frontend**: React 19, Vite, Tailwind CSS v4, Framer Motion.
* **State Management**: Zustand (for reactive UI state), combined with custom Firebase adapters for persistence.
* **Desktop Wrapper**: Electron. Window dragging constraints are mathematically bound to OS screen sizes. Do not alter window bounds without considering `win.getBounds()` and DPI scaling.

## 5. Documentation & Versioning

* **Consistency**: Ensure `package.json`, `DownloadView.jsx`, and `README.md` are always kept in sync during version bumps.
* **Clarity**: Write concise, impactful documentation. Avoid excessive markdown whitespace. Use GitHub alerts (e.g., `> [!WARNING]`) to highlight important developer notes.

By strictly adhering to these rules, you will maintain FloatGPT's premium, robust, and highly-optimized architecture.
