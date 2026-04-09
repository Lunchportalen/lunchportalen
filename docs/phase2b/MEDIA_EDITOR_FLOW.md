# Media — editor flow (Phase 2B)

## 1. Mediearkiv (library page)

**Route:** `app/(backoffice)/backoffice/media/page.tsx`

Flow:

1. `GET /api/backoffice/media/items?limit=...` loads list (credentials included).
2. User can edit **alt**, caption, tags via `PATCH /api/backoffice/media/items/[id]`.
3. Upload / add-by-URL flows call the routes implemented in `app/api/backoffice/media/` (see `MEDIA_RUNTIME_PLAN.md` for parity with `docs/MEDIA_API_CONTRACT.md`).
4. Thumbnails use `url` from each item; defensive fallback on image error.

## 2. In-page: Media picker

**Hook:** `app/(backoffice)/backoffice/content/_components/useMediaPicker.ts`  
**Modal:** `MediaPickerModal.tsx`

- Picker lists existing items (same API contract as library).
- Selection applies to block fields; helpers ensure **UUID vs raw URL** rules (see tests `tests/cms/useMediaPickerHelpers.test.ts`).
- **Rule:** Do not store a bare HTTP URL in a field meant for `mediaItemId` — tests encode this safety.

## 3. Save / preview / publish

- Workspace save persists **block JSON** as today.
- **Server render / preview:** `resolveBlockMediaDeep` walks blocks and calls `resolveMedia` for UUIDs.
- **Client preview** may use `syncResolvePublishedImages` or equivalent — must stay consistent with server resolution order (see `lib/cms/media/`).

## 4. Alt text

- **Source of truth** for library-backed images: `media_items.alt` when blocks reference by id.
- Blocks may duplicate alt in block data for historical reasons; implementation should prefer **one** update path (PATCH media vs block) to avoid drift — Phase 2B can document “last writer wins” or sync rules when implementing.

## 5. AI-assisted alt / generation

- AI endpoints (e.g. image suggestion / generation flows under `app/api/backoffice/ai/`) must **land assets in `media_items`** with `source = 'ai'` when producing durable library entries — no parallel store.

## 6. What editors must not assume

- **Delete:** Contract in `docs/MEDIA_API_CONTRACT.md` states DELETE may not exist — UI must not promise hard delete if API forbids it.
- **Flat list:** No nested “folders” in media in current model; search/filter are UX concerns only.
