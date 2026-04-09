# U31R Content Workspace Runtime

- Title: Rebalance the content workspace around tree, editor, actions, and footer
- Scope: `app/(backoffice)/backoffice/content/_workspace/ContentDashboard.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspaceWorkspaceShell.tsx`, `app/(backoffice)/backoffice/content/_components/LeftSidebar.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspacePublishBar.tsx`, `app/(backoffice)/backoffice/content/_components/ContentSaveBar.tsx`, and `components/backoffice/BackofficeWorkspaceFooterApps.tsx`.
- Repro:
  1. Open `/backoffice/content`.
  2. Open a page in `/backoffice/content/[id]`.
  3. Inspect how the overview, left workspace rail, lower action zone, and footer status compete with each other.
- Expected: the content workspace should read as one coherent flow: section overview -> tree navigation -> page workspace -> bottom actions/status.
- Actual: the root page was not a trustworthy overview, the tri-pane workspace felt crowded, and lower controls/status were spread across multiple weak surfaces.
- Root cause: workspace ownership and Bellissima-style hierarchy were only partially implemented across overview, left rail, lower controls, and footer.
- Fix: strengthen the section overview, use one clearer tri-pane container, simplify the left workspace rail, collect publish/history/save in one calmer zone, and reduce redundant footer actions.
- Verification:
  - `tests/backoffice/content-page-smoke.test.tsx`
  - `npm run test:run`
  - `npm run build:enterprise`

## Section Overview

- `ContentDashboard` is now the canonical section landing surface for `/backoffice/content`.
- The overview explicitly communicates:
  - tree-first navigation
  - editor/preview/inspector as the working surface
  - degraded tree/audit posture as an honest runtime state

## Workspace Shell

- `ContentWorkspaceWorkspaceShell.tsx` now uses a single rounded container for both preview-only and edit modes.
- Edit mode runs with a wider center column and calmer side proportions: `minmax(220px,260px) / minmax(0,1.42fr) / minmax(320px,min(33vw,420px))`.
- This keeps the editor canvas dominant while preserving side rails for structure and inspector work.

## Left Rail And Lower Controls

- `LeftSidebar.tsx` now frames the inner left rail as `Sideinternt`, making it clear that section navigation belongs to the content tree, not inside the page workspace.
- The left tabs now read `Side`, `Blokker`, and `AI`, which is less jargon-heavy than the previous labels.
- `ContentWorkspacePublishBar.tsx` now groups version history and save actions under one `Publisering og historikk` surface.
- `ContentSaveBar.tsx` no longer adds another glass shell inside that zone, which reduces nested chrome noise.

## Footer Status

- `BackofficeWorkspaceFooterApps.tsx` now promotes the workspace label as a readable badge and filters redundant entity actions like preview, settings, and edit.
- The footer remains the lower status strip for lifecycle, save state, view mode, and selected settings shortcuts, instead of duplicating the primary action zone above.
