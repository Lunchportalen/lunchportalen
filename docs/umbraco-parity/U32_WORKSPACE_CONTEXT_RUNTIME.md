# U32 - Workspace context runtime

- Title: U32 real shared workspace context
- Scope: `components/backoffice/ContentBellissimaWorkspaceContext.tsx`, `lib/cms/backofficeWorkspaceContextModel.ts`, `app/(backoffice)/backoffice/content/_workspace/MainViewContext.tsx`, and content workspace consumers.
- Repro:
  1. Open a content detail workspace.
  2. Inspect how title, slug, publish state, views, actions, footer apps, and history/runtime posture move through the UI.
  3. Observe that local editor props and compatibility state still compete with the shared workspace story.
- Expected: one scoped workspace context exposes the canonical Bellissima model for the active workspace instance.
- Actual: there was an active provider, but it still behaved more like a snapshot publisher than a real shared runtime context.
- Root cause: the model was not rich enough and the active view/action contract still leaked through local editor state.
- Fix: expand the shared workspace model, let the provider own active view and action handlers, and make old local view helpers read through that shared line.
- Verification:
  - `npx vitest run tests/cms/bellissimaWorkspaceContext.test.ts tests/cms/backofficeWorkspaceContextModel.test.ts --config vitest.config.ts`
  - `npm run typecheck`
  - `npm run test:run`

## Canonical context now

- Canonical provider: `ContentBellissimaWorkspaceContext`
- Canonical model builder: `buildContentBellissimaWorkspaceSnapshot()`, `buildContentSectionBellissimaWorkspaceSnapshot()`, and `buildContentBellissimaWorkspaceModel()`
- Scope: one workspace instance at a time under the content host

## Data now carried in context

- `entityId`
- `entityType`
- `title`
- `slug`
- `subtitle`
- `documentTypeAlias`
- `publishState`
- `governedPosture`
- `previewState`
- `runtimeLinkage`
- `runtimeLinkageLabel`
- `primaryActions`
- `secondaryActions`
- `entityActions`
- `historyStatus`
- `activeWorkspaceView`
- `footerApps`

## Consumers now reading from the shared model

- `BellissimaWorkspaceHeader`
- `BackofficeWorkspaceFooterApps`
- `ContentSaveBar`
- `BellissimaEntityActionMenu`
- `MainViewContext` compatibility wrapper
- content landing and content detail publishers

## What remains local state

- block DnD/selection/hover
- modal open state
- preview device mode
- temporary form input state
- transient AI request state
- canvas-specific layout toggles

These remain local because they are editor mechanics, not cross-surface workspace identity.

## Result

- Workspace identity is now explicit and shared.
- Header, footer, actions, and view tabs read from the same source.
- The editor is still stateful locally where it should be, but it no longer invents a separate top-level workspace model.
