# Media — read / write flow (Phase 2B2)

## Read

1. **Mediearkiv** (`/backoffice/media`): `GET /api/backoffice/media/items?limit=100` with credentials; `parseMediaItemListFromApi` drops invalid rows (missing id/url).
2. **Picker**: loads the same list (or subset); selection applies `id` + `url` + `alt` into block fields via `applyMediaSelectionToBlock` — see `useMediaPicker.ts`.
3. **Single item**: `GET /api/backoffice/media/items/[id]` for detail or editor refresh.
4. **Render**: Server `resolveMedia(uuid)` or `resolveMediaInNormalizedBlocks` after normalization — never trust client-only URLs for UUIDs without server pass on publish/preview.

## Write

| Action | Flow |
|--------|------|
| **Register external URL** | `POST /api/backoffice/media/items` with `url`, optional `alt`, `caption`, `tags`, `displayName`, optional `metadata` (incl. `variants`). |
| **Upload file** | `POST /api/backoffice/media/upload` multipart: `file` required; optional `displayName`, `alt`, `caption`, `tags`. Inserts `media_items` with storage path in `metadata`. |
| **Metadata / alt / variants** | `PATCH /api/backoffice/media/items/[id]` with any of: `alt`, `caption`, `tags`, `status`, `displayName` (merges into `metadata.displayName`), `metadata` (merge; `metadata.variants` normalized). |
| **Delete row** | `DELETE /api/backoffice/media/items/[id]` — removes DB row only; blocks may still hold stale UUIDs (application-level integrity; UI warns). |

## Reuse

- Multiple blocks may reference the same `media_items.id` in `imageId` / `mediaItemId`.
- **Removing from a block** is a block save (clear id/url fields) — not a DELETE on `media_items` unless explicitly chosen in Mediearkiv.

## Editor sequence (canonical)

1. Open picker → list from GET items.
2. Pick row → UUID + URL + alt written to block.
3. Optional: set `mediaVariantKey` on block data when variants exist.
4. Save page → persisted JSON; preview/publish resolve URLs server-side.

## Contract reference

Authoritative HTTP details: **`docs/MEDIA_API_CONTRACT.md`** (aligned with this phase).
