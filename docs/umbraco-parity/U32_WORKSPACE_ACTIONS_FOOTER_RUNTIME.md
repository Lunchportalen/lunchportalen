# U32 - Workspace actions and footer runtime

- Title: U32 explicit workspace actions and footer apps
- Scope: `lib/cms/backofficeWorkspaceContextModel.ts`, `components/backoffice/BellissimaWorkspaceHeader.tsx`, `components/backoffice/BackofficeWorkspaceFooterApps.tsx`, `app/(backoffice)/backoffice/content/_components/ContentSaveBar.tsx`, and action wiring from `ContentWorkspace.tsx`.
- Repro:
  1. Open the content landing and a content detail workspace.
  2. Compare where save/publish/preview/history/settings/status live.
  3. Observe that actions and status are partly duplicated between topbars, savebars, and ad-hoc badges.
- Expected: primary actions, secondary actions, and footer apps are explicit and shared by the workspace model.
- Actual: the action story existed, but it was only partially modeled and still leaked through local button stacks.
- Root cause: action descriptors and footer apps were not the primary source of truth for the editor shell.
- Fix: define actions and footer apps in the canonical Bellissima model, let the header/footer consume them directly, and let the save bar fall back only when the model is absent.
- Verification:
  - `npx vitest run tests/cms/bellissimaWorkspaceContext.test.ts tests/cms/backofficeWorkspaceContextModel.test.ts --config vitest.config.ts`
  - `npm run test:run`
  - `npm run build:enterprise`

## Primary actions now

- Section scope:
  - `create`
- Entity scope, depending on state:
  - `save`
  - `publish`
  - `preview`
  - `public_page`

## Secondary actions now

- `history`
- `settings`
- `public_page`
- `unpublish`
- `reload` where relevant in section/operator flows

## Footer apps now

- publish state
- history state
- document type / governance posture
- runtime linkage
- other calm status apps derived from the active workspace model

## Result

- The header now carries deliberate action intent instead of local button drift.
- The footer now acts like a persistent status/app zone rather than a loose badge strip.
- `ContentSaveBar` can now render model-driven actions, which keeps the editor action language aligned with the host.
