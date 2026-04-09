- Title: U36-RC decision
- Scope: final decision for workspace truth, management objects, property editor system, degraded operator UX, and compat shutdown.
- Repro:
  1. Open `/backoffice/content/[id]` and inspect footer/history/preview/state chips.
  2. Open `/backoffice/settings`, `document-types`, `data-types`, `schema`, `create-policy`, and `management-read`.
  3. Trigger degraded tree and audit payloads via the existing route tests.
- Expected: Bellissima-like management/workspace closure with one canonical shell truth, legible management objects, honest property-editor system mapping, and operator-useful degraded states.
- Actual: U36 closes the remaining structural gaps without inventing new engines or fake CRUD. Footer truth is model-owned, settings flows read as management objects, property editor relations are explicit, degraded tree/audit payloads tell operators what to do next, and one real compat barrel is removed.
- Root cause: the repo already had most primitives, but a few remaining wrapper layers and under-modeled settings reads diluted ownership and made Bellissima parity feel partial.
- Fix: finish structural closure in the canonical model and registry layers rather than adding more local UI truth.
- Verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build:enterprise`
  - `npm run test:run`

## Decision

GO for U36-RC.

This phase achieves the requested closure level for:

- workspace truth across footer apps, shortcut apps, history posture, preview posture, and document/governance linkage
- first-class management object flows for document types, data types, schema/presets, create policy, and management-read
- one explicit property-editor system model: schema -> configured instance -> editor UI -> preset/defaults
- stronger operator-grade degraded messaging for content tree and audit
- real compat shutdown through removal of `lib/cms/backofficeNavItems.ts`

## Explicit Non-Replatforming Boundaries

- Document types, data types, presets, and create policy remain code-governed.
- No persisted CRUD or parallel management API was introduced.
- No new property-editor engine or AI orchestrator was introduced.
- Existing runtime truths for auth, orders, onboarding, delivery, billing, and tenant scope were not changed.
