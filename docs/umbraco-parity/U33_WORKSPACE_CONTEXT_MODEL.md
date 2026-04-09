# U33 Workspace Context Model

- Title: Canonical shared workspace context for U33
- Scope: Bellissima workspace snapshot/model, shared shell state, and consumers.
- Repro:
  1. Open a content workspace.
  2. Switch workspace view.
  3. Use the right rail and footer while save/history/preview state changes.
- Expected: one shared model drives header, tabs, actions, footer, save state, and shell-level inspector/runtime/AI switching.
- Actual: entity snapshot publishing exists, but some shell state still lives locally and dead parallel context files remain.
- Root cause: the Bellissima model was introduced before the old shell state was fully removed.
- Fix: keep one provider/model and move remaining workspace shell state into it.
- Verification:
  - Header, footer, save bar, right rail, and inspector consume the same context line.
  - Switching views/side apps does not desynchronize the shell.

## Canonical Model

- Canonical provider: `components/backoffice/ContentBellissimaWorkspaceContext.tsx`
- Canonical model types: `lib/cms/backofficeWorkspaceContextModel.ts`

## Required Shared Data

- `entityId`
- `entityType`
- `title`
- `slug`
- `documentType`
- `publishState`
- `governance posture` (`legacy` / `governed`)
- `previewState`
- `runtime linkage`
- `primaryActions`
- `secondaryActions`
- `historyState`
- `active workspace view`
- `active side app`
- `active inspector section`

## Components That Must Read From Context

- `components/backoffice/BellissimaWorkspaceHeader.tsx`
- `components/backoffice/BackofficeWorkspaceFooterApps.tsx`
- `app/(backoffice)/backoffice/content/_components/ContentSaveBar.tsx`
- `app/(backoffice)/backoffice/content/_components/RightPanel.tsx`
- `app/(backoffice)/backoffice/content/_components/ContentWorkspacePropertiesRail.tsx`
- `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceHost.tsx`
- `app/(backoffice)/backoffice/content/_workspace/MainViewContext.tsx` only as transitional adapter if still required during U33

## State That May Stay Local

- Short-lived modal visibility
- Drag/drop hover state
- Inline form focus state
- Ephemeral animation timing
- Network request internals that only feed snapshot updates after resolution
