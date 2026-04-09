# CMS design — preview, publish, rollback (Phase 2A)

## Preview

- **Editor live preview** (`PublicPageRenderer` / `LivePreviewPanel`): uses global settings JSON from **`/api/content/global/settings`** (full `data` root) plus **`pageCmsMeta`** from editor state (or history snapshot).
- **Published site:** `CmsBlockRenderer` uses **`getGlobalSettingsDataRoot()`** (server) + **`pageCmsMeta`** from **`loadLivePageContent`** / `parseBodyMeta(row.body)`.
- **Same merge:** `buildEffectiveParsedDesignSettingsLayered` in both paths.

## Publish

- Page/section design is part of **`meta`** inside the saved body `{ blocks, meta }`. Publishing promotes the variant body as today; no separate “design publish” channel.

## Rollback

- Version history stores **whole body** JSON. Restoring a version restores **`meta.pageDesign`** and **`meta.sectionDesign`** together with blocks — no orphan global leaks.
- **No cross-page leakage:** `meta` is per page variant body; other slugs are unaffected.

## Fail-closed

- `parseBodyMeta` returns `{}` when `meta` is missing or invalid.
- Unknown `sectionId` on a block: no section overlay applies (only keys present in `meta.sectionDesign`).
