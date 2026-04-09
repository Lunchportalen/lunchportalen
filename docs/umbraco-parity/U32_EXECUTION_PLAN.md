# U32 Execution Plan

- Title: U32 Bellissima structural parity, content workspace host, and real workspace context
- Scope: `app/(backoffice)/backoffice/content/**`, `app/(backoffice)/backoffice/settings/**`, `app/api/backoffice/content/**`, `components/backoffice/**`, `lib/cms/**`, and focused CMS/backoffice tests.
- Repro:
  1. Open `/backoffice/content` and observe that the section root is still weaker than a true content-first workspace entry.
  2. Open `/backoffice/content/[id]` and observe that the editor runtime still publishes workspace posture from inside `ContentWorkspace.tsx`, while views/actions/footer state remain split across local props and helper layers.
  3. Compare tree, workspace, audit, footer, and settings behavior against Bellissima concepts: one workspace host, one workspace context, explicit views/actions/footer apps, and consistent entity actions.
- Expected: content acts as a first-class section with one canonical host, one real shared workspace context, explicit workspace views/actions/footer apps, stable tree/audit posture, and a management-grade settings flow.
- Actual: the active Bellissima model exists, but it is still partial; `MainViewProvider`, local editor props, and an older Bellissima stack fragment the workspace story.
- Root cause: the section shell, workspace model, and editor runtime evolved in parallel rather than being consolidated under one canonical host/context contract.
- Fix: turn the active `ContentBellissimaWorkspace` line into the real workspace context, mount a canonical content workspace host at section level, switch `/backoffice/content` back to a tree-first landing, unify views/actions/footer/entity actions, and harden tree/audit posture without parallel systems.
- Verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build:enterprise`
  - `npm run test:run`

## Frozen Flow Check

- No frozen company lifecycle flow is touched.
- No onboarding, auth, billing, order, or employee runtime truth is moved into CMS.
- Week/menu, agreement/company/location, and operational ordering remain on existing runtime truth.

## Impacted Flows

- `/backoffice/content`
- `/backoffice/content/[id]`
- `/backoffice/content/growth`
- `/backoffice/content/recycle-bin`
- `/backoffice/settings`
- `/api/backoffice/content/tree`
- `/api/backoffice/content/audit-log`
- `/api/backoffice/content/pages`
- `/api/backoffice/content/pages/[id]`

## Structural Gaps To Close Now

- One canonical content workspace host is missing.
- One canonical shared workspace context is still missing.
- Workspace views/actions/footer apps are only partially real.
- Entity actions are inconsistent between tree, landing/collection, and workspace.
- Tree/audit degraded truth exists, but the operator posture is not unified enough.
# U32 - Execution plan

## Goal
- Move content/settings from improved UI to explicit Bellissima-like structure.
- Build one real workspace host + context model for content workspaces.

## Build slices
1. Consolidate registry into section -> menu -> collection/workspace metadata.
2. Make `ContentWorkspaceLayout` route-first and host-driven, not local-selection-driven.
3. Expand workspace context from snapshot-only to views/actions/footer/entity metadata.
4. Make editor views explicit: content, preview, history, global, design.
5. Strengthen tree/audit degraded handling and expose it honestly in workspace UI.
6. Lift Settings into collection -> workspace flows driven by the same registry.

## Hard boundaries
- No auth/onboarding/order/billing truth changes.
- No parallel editor/tree/settings/history systems.
- Reuse existing routes, editor hooks, publish flow, and governance registries.

## Verification
- `npm run typecheck`
- `npm run lint`
- `npm run build:enterprise`
- `npm run test:run`
