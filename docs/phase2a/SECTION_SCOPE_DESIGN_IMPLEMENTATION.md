# Section-scope CMS design — implementation (Phase 2A)

## Model

- **`meta.sectionDesign`:** `Record<sectionId, DesignSettingsDocument>` — each value uses the same token/preset shape as global `designSettings` (no free CSS).
- **`block.config.sectionId`:** optional string referencing a key in `meta.sectionDesign`.

Constants: `CMS_META_SECTION_DESIGN_KEY` (`"sectionDesign"`).

## Behaviour

1. Editor creates named section IDs (e.g. `sec_intro`) and edits tokens per section in **CMS-design (seksjon)**.
2. Blocks assign **Seksjon** in **CMS-design (blokk)** (`CmsBlockDesignSection`).
3. At render, `buildEffectiveParsedDesignSettingsLayered` applies:
   - global → page → **section overlay for `config.sectionId`** → `mergeFullDesign` with block `config`.

## Isolation

- Section **A** only applies to blocks with `sectionId === "A"`. Other blocks on the same page do not inherit section **A**’s tokens unless they reference the same id.

## UI

- `CmsSectionScopeDesignSection` + section dropdown on `CmsBlockDesignSection` when `meta` is passed.

## Persistence

- Stored only in page body `meta`, versioned with the same draft/publish/history as the rest of the body.
