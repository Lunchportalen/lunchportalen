# U34 Workspace Context Model

- Title: U34 canonical workspace context
- Scope: Bellissima workspace truth for content workspaces and shared shell state.
- Repro: switch entity views, preview posture, inspector focus, and runtime/history state inside one workspace.
- Expected: one context/model line drives header, footer, preview, inspector, save status, and workspace views.
- Actual: content already has a canonical provider, but view/preview shell state and some compat naming still live outside the real Bellissima model.
- Root cause: U33 moved side app + inspector truth into context, but preview/view shell state was left partly local.
- Fix: let Bellissima workspace context own the remaining shared shell state and remove transitional `MainView` indirection.
- Verification:
  - Header/footer/savebar/preview/inspector read the same active workspace view.
  - Preview shell state survives rerenders and resets only when workspace scope changes.
  - No second view-state adapter remains in content runtime.

## Canonical Context

- Provider: `components/backoffice/ContentBellissimaWorkspaceContext.tsx`
- Model types/builders: `lib/cms/backofficeWorkspaceContextModel.ts`

## Required Shared Data

- `entityId`
- `entityType`
- `title`
- `slug`
- `documentType`
- `publishState`
- `governedPosture`
- `previewState`
- `runtimeLinkage`
- `primaryActions`
- `secondaryActions`
- `footerApps`
- `historyState`
- `activeWorkspaceView`
- `availableViews`
- `activeSideApp`
- `activeInspectorSection`
- `previewDevice`
- `previewLayoutMode`
- `showPreviewColumn`

## Must Read From Context

- `BellissimaWorkspaceHeader`
- `BackofficeWorkspaceFooterApps`
- `ContentSaveBar`
- `RightPanel`
- `ContentWorkspacePropertiesRail`
- `ContentWorkspaceMainCanvas`
- content navigation/shell hooks
- `ContentWorkspaceHost`

## May Stay Local

- modal open/close state
- drag/drop hover and animation state
- inline focus/selection state
- request controllers and short-lived network progress internals
