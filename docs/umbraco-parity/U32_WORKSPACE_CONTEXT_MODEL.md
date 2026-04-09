# U32 Workspace Context Model

- Title: One canonical shared content workspace context
- Scope: `components/backoffice/ContentBellissimaWorkspaceContext.tsx`, `lib/cms/backofficeWorkspaceContextModel.ts`, content host/header/footer readers, and editor workspace publishers.
- Repro:
  1. Inspect the existing `ContentBellissimaWorkspaceProvider`, `MainViewProvider`, and local editor shell state.
  2. Observe that the footer reads from one model while active view and actions still live elsewhere.
- Expected: one shared workspace context is the read source for the host, header, views, footer apps, and workspace-aware editor panels.
- Actual: the context currently carries only a partial snapshot, while active view and action behavior still live in local props/hooks.
- Root cause: the provider was introduced as a footer/status publisher first, not as the canonical workspace runtime context.
- Fix: expand the active content workspace context into the single canonical shared context for Bellissima-style workspace posture and shell behavior.
- Verification:
  - host, header, tabs, footer, and editor readers all consume the same context
  - view switching works without `MainViewProvider`
  - landing and detail workspaces publish a coherent snapshot

## Canonical Context

- Canonical provider/runtime context:
  - `components/backoffice/ContentBellissimaWorkspaceContext.tsx`
- Canonical typed model:
  - `lib/cms/backofficeWorkspaceContextModel.ts`

## Data That Must Live In Context

- `entityId`
- `entityType`
- `title`
- `slug`
- `documentType`
- `publishState`
- `legacy/governed posture`
- `previewState`
- `runtime linkage`
- `primary actions`
- `secondary actions`
- `history state`
- `active workspace view`
- `workspace views`
- `entity actions`
- `footer apps`

## Components That Must Read From Context

- content workspace host/header
- workspace view tabs
- workspace entity action menu
- footer apps/status strip
- content landing surface
- detail editor shell
- preview/open actions
- history/audit posture readers

## What Can Stay Local State

- block editing draft state
- drag/drop hover and transient selection details
- modal open/close state
- form field drafts inside create/rename dialogs
- preview device mode
- temporary UI feedback such as copy/saved animations

## U32 Context Rule

- The context is for workspace-shell truth and shared posture.
- The editor keeps local field/editing state where that avoids a parallel mutation engine.
- No second Bellissima context may remain authoritative for content workspaces after U32.
