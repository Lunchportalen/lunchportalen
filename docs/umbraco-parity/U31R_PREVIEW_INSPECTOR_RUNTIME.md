# U31R Preview Inspector Runtime

- Title: Give preview and inspector first-class, calmer runtime surfaces
- Scope: `app/(backoffice)/backoffice/content/_components/ContentWorkspaceMainCanvas.tsx`, `app/(backoffice)/backoffice/content/_components/RightPanel.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspacePropertiesRail.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspaceHistoryView.tsx`, and `app/(backoffice)/backoffice/content/_components/ContentWorkspaceAuditTimeline.tsx`.
- Repro:
  1. Open a content page in edit mode.
  2. Compare the size and clarity of preview, inspector tabs, history, and runtime messaging.
- Expected: preview should feel like a true secondary surface, and inspector/runtime information should be grouped instead of scattered.
- Actual: preview was cramped, inspector labels were dense, and history/runtime posture was spread between multiple panels.
- Root cause: the workspace had too many competing cards and too little semantic grouping between content editing, preview, and diagnosis.
- Fix: enlarge preview, relabel and regroup the inspector, move degraded runtime context into a dedicated diagnosis tab, and consolidate history/audit signals into calmer surfaces.
- Verification:
  - `npm run typecheck`
  - `npm run test:run`
  - `npm run build:enterprise`

## Preview Surface

- `ContentWorkspaceMainCanvas.tsx` now gives the preview a larger dedicated secondary panel with the `Stor sekundærflate` marker.
- The preview header states that it uses the same renderer and content data as the public page, which makes the surface more trustworthy.
- History preview mode is still explicit and reversible through the existing version history flow.

## Inspector Surface

- `RightPanel.tsx` now groups the inspector into three clearer tabs:
  - `Innhold`
  - `AI`
  - `Diagnose`
- The diagnosis tab explicitly explains that degraded audit, runtime signals, and history status live there instead of being scattered across the editor.

## Properties And Runtime Grouping

- `ContentWorkspacePropertiesRail.tsx` relabels the legacy tabs to `Design`, `Governance`, and `Listing` where appropriate.
- Secondary inspector sections now sit behind `<details>` wrappers, which reduces initial density while preserving access to the governed controls.
- `ContentWorkspaceHistoryView.tsx` consolidates history status, governance posture, and version/preview tools into one scan-friendly header zone.
- `ContentWorkspaceAuditTimeline.tsx` exposes operator-facing messages, audit source, and degraded status chips instead of generic empty-state text.
