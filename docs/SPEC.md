# FloatGPT - Phase 1 Specification

## Product Spec
FloatGPT is a focused project planning and execution application.
**Core Navigation:** Home, Plan, Chat.
**UI Language:** Goal, Next Action, Plan, Risk, Progress, Resources.

## Component Map
- `App` (Root Layout & State Provider)
  - `Sidebar` (Navigation)
  - `Views`
    - `HomeView` (Dashboard: Goals, Next Actions, Progress)
    - `PlanView` (Management: Projects, Tasks, Risks, Resources)
    - `ChatView` (AI Interface)
  - `Components` (Shared UI elements)

## State Map
- `goals`: High-level objectives.
- `projects`: Initiatives under goals.
- `tasks`: Actionable items (Next Action, Plan).
- `risks`: Potential roadblocks.
- `resources`: Assets and links.
- `history`: Log of completed items.
