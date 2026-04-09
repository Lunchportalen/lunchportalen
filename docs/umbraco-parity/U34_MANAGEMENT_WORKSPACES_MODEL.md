# U34 Management Workspaces Model

- Title: U34 first-class management workspaces
- Scope: settings section collection/detail/workspace flows and honesty boundaries.
- Repro: open settings hub, collections, and detail routes for schema-governed management.
- Expected: settings behaves like a real Bellissima management section, not a shelf of unrelated info pages.
- Actual: collections exist, but they still lack one shared workspace model/frame and AI governance is not yet first-class inside settings.
- Root cause: U29-U33 established settings routes and honesty, but not a unified management workspace runtime.
- Fix: build one shared settings workspace model and reuse it across collection and detail workspaces.
- Verification:
  - Every settings route resolves to a defined collection/workspace model entry.
  - Collection/detail pages share the same header/signals/actions language.
  - Code-governed vs runtime-read posture stays explicit.

## First-Class Management Workspaces Now

- `document-types`
- `data-types`
- `schema`
- `create-policy`
- `management-read`
- `governance-insights`
- `ai-governance`
- `system`

## Collection Views

- `document-types`
- `data-types`

## Detail / Workspace Views

- document type detail
- data type detail
- schema/presets summary
- create policy
- management read
- governance insights
- AI governance
- system and drift

## Required Actions

- open workspace/detail
- open related content/runtime surface
- inspect governance/source of truth
- preview management API/read model when that is the honest posture
- explicit batch/system actions only where runtime already supports them

## Must Stay Honest

- document types remain code-governed
- data types remain code-governed
- schema/presets remain code-governed
- create policy remains code-governed unless routed to existing safe mutation surfaces
- management read is read-only
- governance insights is runtime-read with explicit batch handling
- AI governance may link to existing AI center/runtime settings, but must not invent new AI orchestration
