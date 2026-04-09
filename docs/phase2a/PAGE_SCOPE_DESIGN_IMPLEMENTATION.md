# Page-scope CMS design — implementation (Phase 2A)

## Where it is stored

- **Canonical location:** the page variant **body** JSON, shape `{ blocks: Block[], meta: Record<string, unknown> }`, already used by `serializeBlocksToBody` / `parseBodyToBlocks` in `contentWorkspace.blocks.ts`.
- **No new DB column** for this phase: `meta` is part of the existing block-mode body contract.

## Fields

| Key | Type | Purpose |
|-----|------|---------|
| `meta.pageDesign` | Same inner shape as global `settings.data.designSettings` (see `DesignSettingsDocument` in `lib/cms/design/designContract.ts`) | Token/preset overrides for **this page only** (surface, spacing, typography, layout; optional card map if extended later). |

Constants: `CMS_META_PAGE_DESIGN_KEY` (`"pageDesign"`) in `designContract.ts`.

## Merge position

Order of application for **effective** design tokens before `block.config`:

`global` → **`pageDesign`** → `sectionDesign[id]` → **`mergeFullDesign`** (block `config` wins on each field).

Implementation: `buildEffectiveParsedDesignSettingsLayered(globalDataRoot, pageMeta, sectionId)` merges global inner `designSettings` with `pageDesign` and optional section overlay using `mergeDesignSettingsIntoGlobalContentData`, then parses once with `parseDesignSettingsFromSettingsData`.

## UI

- `CmsPageScopeDesignSection` in `CmsPageSectionDesignPanels.tsx` (Egenskaper → Innhold).

## Persistence

- Saved with the same page save/publish flow as blocks; `meta` is included in `deriveBodyForSave` when `bodyMode === "blocks"`.
