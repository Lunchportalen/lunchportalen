- Title: U36-RC workspace truth model
- Scope: the one Bellissima workspace line for content shell state.
- Repro: inspect header, content-app tabs, savebar, preview, inspector, and footer while switching content views.
- Expected: all shared shell state is read from one canonical model.
- Actual: the provider/model line exists, but footer rendering and some history/governance signals still get recomposed outside the canonical footer-app list.
- Root cause: U35 converged section/entity publishing, but not every workspace-visible primitive was promoted fully into the model.
- Fix: finish the promotion so consumers render, not reinterpret.
- Verification: header, savebar, preview, inspector, and footer all read the same workspace model.

## Canonical Owners

- React owner:
  `components/backoffice/ContentBellissimaWorkspaceContext.tsx`
- Snapshot + model builder:
  `lib/cms/backofficeWorkspaceContextModel.ts`
- Section publisher:
  `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceHost.tsx`
- Entity publisher:
  `app/(backoffice)/backoffice/content/_components/useContentWorkspaceBellissima.ts`

## This Model Must Own

- active workspace view
- primary actions
- secondary actions
- entity actions
- footer apps
- active side app
- active inspector section
- preview device and preview layout
- preview availability / runtime linkage / governance posture
- history posture signals that shell chrome needs to show persistently

## Things That Must Stop Being Ad Hoc

- footer-only recomposition of workspace identity, active panel, inspector, and management shortcuts
- duplicated route/action imports through compat barrels
- management pages that restate property-editor truth instead of reading the shared system model
