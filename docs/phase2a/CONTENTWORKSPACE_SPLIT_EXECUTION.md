# Phase 2A — ContentWorkspace split execution

## Intent

Continue structural decomposition of the editor chrome **without** changing business logic, save/publish behavior, or preview pipeline.

## Modules introduced

### 1. `ContentWorkspaceEditorChrome.types.ts`

- **`statusTone(status)`** — badge styling helper (moved from inline in former `ContentWorkspaceEditorChrome.tsx`).
- **`ContentWorkspaceHeaderChromeProps`** — full prop set for the upper chrome.
- **`ContentWorkspaceEditorChromeProps`** — alias of header props (same shape as before for `contentWorkspaceChromeProps.ts` and `ContentWorkspaceChrome.tsx`).

### 2. `ContentWorkspaceHeaderChrome.tsx`

- Renders:
  - `ContentTopbar`
  - `ContentWorkspaceOutboxRecoveryBanner`
  - `ContentWorkspaceEditorModeStrip`
- **No new hooks**; presentation only.

### 3. `ContentWorkspacePublishBar.tsx`

- Renders:
  - `ContentPageVersionHistory` + `ContentSaveBar` (non-demo)
  - `ContentSaveBar` only (demo)
- Types: **`ContentWorkspacePublishBarProps`** (new name).
- **Backward compatibility:** **`ContentWorkspaceEditorLowerControls`** and **`ContentWorkspaceEditorLowerControlsProps`** exported as aliases for `ContentWorkspaceAuxiliaryShell` and any other consumer.

### 4. `ContentWorkspaceEditorChrome.tsx`

- **`ContentWorkspaceEditorChrome`** = `<ContentWorkspaceHeaderChrome {...props} />`.
- Re-exports: `ContentWorkspacePublishBar`, `ContentWorkspaceEditorLowerControls`, and both prop types from `ContentWorkspacePublishBar.tsx`.

## Consumers (unchanged imports)

| Consumer | Import |
|----------|--------|
| `ContentWorkspaceChrome.tsx` | `ContentWorkspaceEditorChrome`, `ContentWorkspaceEditorChromeProps` |
| `contentWorkspaceChromeProps.ts` | `ContentWorkspaceEditorChromeProps` |
| `ContentWorkspaceAuxiliaryShell.tsx` | `ContentWorkspaceEditorLowerControls`, `ContentWorkspaceEditorLowerControlsProps` |

## V3 additions

- **`ContentWorkspacePreviewPane.tsx`** — full-width `PreviewCanvas` branch extracted from `ContentWorkspaceMainCanvas`.
- **`CmsDesignTargetingBar.tsx`** — page/slug + selected block + shortcut to global design settings (same shell navigation as before).

## Not split in 2A V3

- **Full editor canvas pane** — DnD block list remains in `ContentWorkspaceMainCanvas` to avoid a high-risk duplicate module; preview branch is extracted.
- **`ContentInspectorPane`** — inspector remains embedded in the canvas + properties rail; block-level design controls are in **`CmsBlockDesignSection`** (properties).
