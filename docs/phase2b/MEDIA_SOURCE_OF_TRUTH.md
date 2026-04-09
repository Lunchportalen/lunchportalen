# Media — source of truth (Phase 2B2)

## Canonical truth

| Layer | Authority |
|-------|-----------|
| **Persistent rows** | PostgreSQL table `media_items` — one row per library asset (`id` UUID, `url`, `alt`, `caption`, `tags`, typed columns + `metadata` JSONB). |
| **CMS read path (list/detail)** | `GET /api/backoffice/media/items` and `GET /api/backoffice/media/items/[id]` — superadmin only; responses normalized via `rowToMediaItem` / `parseMediaItemFromApi` on the client. |
| **CMS write path** | `POST /api/backoffice/media/items` (URL register), `POST /api/backoffice/media/upload` (multipart → storage + row), `PATCH` / `DELETE` on `[id]`. |
| **Render / preview / publish** | Same URL resolution: `resolveMedia` → optional `metadata.variants[key]`; block pipeline `resolveMediaInNormalizedBlocks` in `resolveBlockMediaDeep.ts` fills `image` / `src` / `imageUrl` / `assetPath` from `imageId` / `mediaItemId` and optional `mediaVariantKey`. |
| **Published registry** | `cms:*` keys via `resolvePublishedImageRef` inside `resolveMedia` — for bundled editorial assets, not a second DB table. |

**There is no parallel “v2 media” model, no separate AI media table, and no duplicate resolver.** AI-sourced rows use `source = 'ai'` on the same `media_items` table.

## Active code paths (use these)

| Area | Files / routes |
|------|----------------|
| List / create / update / delete API | `app/api/backoffice/media/items/route.ts`, `items/[id]/route.ts`, `upload/route.ts` |
| Domain types & parse | `lib/media/types.ts`, `parse.ts`, `normalize.ts`, `validation.ts` |
| Variants & display label | `lib/media/variantResolution.ts`, `lib/media/displayName.ts` |
| Server resolution | `lib/cms/media/resolveMedia.ts`, `lib/cms/media/resolveBlockMediaDeep.ts` |
| Public / preview render | `components/cms/CmsBlockRenderer.tsx` → `resolveMediaInNormalizedBlocks` |
| Editor picker | `useMediaPicker.ts`, `MediaPickerModal.tsx`, `hasValidSelectionUrl` |
| Mediearkiv UI | `app/(backoffice)/backoffice/media/page.tsx` |

## Legacy / alternate traces (clarified, not duplicated)

| Trace | Status |
|-------|--------|
| **Inline URLs in blocks** | Supported for migration and external assets: if `http(s)` or `/` is stored in `imageId` / `mediaItemId`, `resolveMedia` returns it as-is; `fillRowUrls` copies into URL fields. Prefer UUID + empty URL for canonical reuse. |
| **Block field names** | Multiple keys (`image`, `src`, `imageUrl`, `assetPath`, `backgroundImage`, …) are normalized by block type and deep-fill — not multiple sources of truth, one resolver. |
| **Docs that said “no multipart / no DELETE”** | **Superseded** by implementation: `upload` and `DELETE` exist; see `docs/MEDIA_API_CONTRACT.md`. |

## Deprecation stance

- Do **not** add new storage tables or CDN registries outside `media_items` + existing storage bucket for uploads.
- Prefer extending `metadata` (e.g. `displayName`, `variants`) over new columns unless a hard DB constraint is required.
