# U38 Compat Removal Plan

## Remove Or Neutralize

- Mounted `BlockAddModal` path: no longer used by the canonical workspace modal stack.
- `addBlockModalOpen` / `setAddBlockModalOpen`: removed from `ContentWorkspace`, modal prop builders, modal arg slices, and legacy UI state.
- Settings tab duplication: `BACKOFFICE_SETTINGS_WORKSPACE_VIEWS` now derives from `BACKOFFICE_SETTINGS_COLLECTIONS`.
- `_stubs.ts` block-add export: removed so the compat surface no longer advertises a second insert UI.

## Keep As Explicit Transitional

- `BlockAddModal.tsx`: left in repo only because it already had local edits; it is no longer mounted or exported through the compat shim.
- `ContentWorkspaceActions.ts`: still a thin explicit shim for test/import integrity, not a competing runtime owner.
- `_stubs.ts`: remains as a narrowed adapter for shared helpers and non-competing editor primitives.

## Owner Model After U38

- Block insert truth: `BlockPickerOverlay` + `useContentWorkspaceOverlays`.
- Workspace truth: `ContentBellissimaWorkspaceContext` + `backofficeWorkspaceContextModel`.
- Settings navigation truth: `BACKOFFICE_SETTINGS_COLLECTIONS`.
- Property editor flow truth: `backofficeSchemaSettingsModel`.
