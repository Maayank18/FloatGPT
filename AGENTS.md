# FloatGPT AI Agent Guidelines

This file (`AGENTS.md`) serves as the core instruction manual for any AI agents or LLM-based coding assistants operating within the FloatGPT workspace. 

When generating code, analyzing the project, or providing architectural recommendations, AI agents must adhere to the following principles:

## 1. Architectural Integrity

* **Strict Isolation**: FloatGPT relies on a strict separation between the Electron Desktop app (the "Orb") and the Playground Studio (the Web Dashboard). Never mix their states directly; always use the `SyncBridge` for cross-surface communication.
* **Local-First Priority**: Always prioritize `idb-keyval` for fast local reads/writes before failing over or syncing to Firebase.
* **Memory Layering**: Transcripts from the Playground must *never* overwrite transcripts from the Orb. They share a Memory Layer but maintain independent conversation histories.

## 2. UI/UX & Styling Standards

* **Aesthetic Focus**: FloatGPT is designed for "Calm Execution". Use muted backgrounds (`bg-bg`, `bg-panel`, `bg-card`) with high-contrast text (`text-text-primary`).
* **Animations**: All micro-interactions and layout changes should use `framer-motion` for smooth, physics-based transitions. Never use abrupt DOM removals without an exit animation.
* **Color Usage**: Reserve bright, attention-grabbing colors (Red/Orange/Accent) *strictly* for high-priority warnings, critical deadlines, or primary calls to action. 

## 3. Technology Stack

* **Frontend**: React 19, Vite, Tailwind CSS v4, Framer Motion.
* **State Management**: Zustand (for reactive UI state), combined with custom Firebase adapters for persistence.
* **Desktop Wrapper**: Electron. Window dragging constraints are mathematically bound to OS screen sizes. Do not alter window bounds without considering `win.getBounds()` and DPI scaling.

## 4. Documentation & Versioning

* **Consistency**: Ensure `package.json`, `DownloadView.jsx`, and `README.md` are always kept in sync during version bumps.
* **Clarity**: Write concise, impactful documentation. Avoid excessive markdown whitespace. Use GitHub alerts (e.g., `> [!WARNING]`) to highlight important developer notes.

By strictly adhering to these rules, you will maintain FloatGPT's premium, robust, and highly-optimized architecture.
