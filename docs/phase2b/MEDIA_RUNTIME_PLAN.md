# Media — runtime plan (Phase 2B)

## 1. Canonical pipeline (single spine)

```
Storage (Supabase bucket or external URL)
        ↓
media_items row (url, alt, metadata, source, status)
        ↓
GET/PATCH API → Mediearkiv + Picker
        ↓
Blocks store UUID (imageId / mediaItemId) ± inline URL
        ↓
resolveMedia / resolveBlockMediaDeep → published HTML + preview
```

**Authoritative docs:** `docs/MEDIA_API_CONTRACT.md` — **reconcile** with live routes:

- `app/api/backoffice/media/items/route.ts` — list, POST (URL create)
- `app/api/backoffice/media/items/[id]/route.ts` — get, PATCH
- `app/api/backoffice/media/upload/route.ts` — multipart upload (if present)

If the contract file states “no multipart” while `upload/route.ts` exists, **update the contract doc in the implementation PR** or align implementation — do not leave silent drift.

## 2. Current capabilities (inventory)

| Concern | Status |
|---------|--------|
| List + filter | API + Mediearkiv page |
| Metadata (alt, caption, tags) | PATCH |
| Upload | Dedicated route (verify vs contract) |
| **Variants** | Not first-class columns; possible via `metadata` only |
| **Reuse** | UUID reference from multiple blocks — supported logically |
| **RLS** | Superadmin-only |

## 3. Phase 2B hardening (implementation backlog)

1. **Contract parity:** One truth table in `MEDIA_API_CONTRACT.md` for upload + list + PATCH.
2. **Picker limits:** Align list `limit` with API max (100) — already noted in Mediearkiv.
3. **Variants (optional):** If product requires responsive images, define `metadata.variants` schema **once** and teach `resolveMedia` or block renderers to pick best size — still one `media_items` row.
4. **AI:** Ensure any generation pipeline inserts `media_items` and returns id — same picker.
5. **Integrity:** “Soft delete” or “archive” preferred over hard delete if blocks reference by id.

## 4. Non-goals (2B)

- Separate AI media library UI.
- CDN-specific multi-tenant buckets without security review.
- Changing employee-facing or public non-CMS routes.

## 5. Proof obligations (when implementing)

- `npm run build:enterprise` after media route changes.
- Snapshot or integration test: block with `mediaItemId` resolves same URL in preview and publish path.
