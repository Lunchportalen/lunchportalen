/**
 * U82B — Canonical workspace block dataset (reference only; enforcement via tests + hooks).
 *
 * | Concern            | Owner |
 * |--------------------|--------|
 * | Block list values  | `useContentWorkspaceBlocks` → `blocks` state + `setBlockById` / `setBlocks` |
 * | Page meta          | Same hook → `meta` + `setMeta` |
 * | Body mode / legacy | Same hook → `bodyMode`, `legacyBodyText`, `invalidBodyRaw`, parsers |
 * | Serialized save    | `bodyForSave` useMemo → `deriveBodyForSave` + optional envelope (`serializeBodyEnvelope`) |
 * | Dirty vs server    | `useContentWorkspaceShellModel` → `currentSnapshot` from `{ title, slug, body: bodyForSave }` vs `savedSnapshot` |
 * | Canvas projection  | `displayBlocks` in shell — read-only WOW/history view; never authoritative for mutations |
 * | Selected block     | `useContentWorkspaceUi` → `selectedBlockId` only (no parallel “expanded” truth) |
 * | Property editing   | `ContentWorkspacePropertiesRail` + `BlockInspectorFields` → `BlockPropertyEditorRouter` + per-type editors + `useBlockDatasetAdapter` (BlockInspectorShell = navigator only) |
 */

export const WORKSPACE_BLOCK_DATASET_CANON_MARK = "U82B_WORKSPACE_BLOCK_DATASET_CANON";
