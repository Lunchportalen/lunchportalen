# Phase 2B — Execution log

## Phase 2B1 — Content tree runtime (2026-03-28)

**Status:** Implemented and verified.

### Scope

- Wire `ContentTree` to `GET /api/backoffice/content/tree`; remove mock-driven default roots.
- Persisted create/rename/move; delete from tree deferred (UI disabled).
- Extend `POST /api/backoffice/content/pages` with `tree_parent_id` / `tree_root_key` + computed `tree_sort_order`.
- Expose `treeSortOrder` on page nodes from `GET /api/backoffice/content/tree`.
- Documentation: `CONTENT_TREE_SOURCE_OF_TRUTH.md`, `CONTENT_TREE_READ_FLOW.md`, `CONTENT_TREE_WRITE_FLOW.md`, `CONTENT_TREE_PATH_SAFETY.md`, `CONTENT_TREE_EDITOR_RUNTIME.md`.

### Gates (2B1)

- `npm run typecheck` — PASS
- `npm run lint` — PASS (warnings pre-existing in repo)
- `npm run build:enterprise` — PASS (exit 0)

### Tests added/updated

- `tests/cms/mapTreeApiRoots.test.ts` (new)
- `tests/api/contentPages.test.ts` — Supabase mock extended for tree sort queries before insert

---

## Phase 2B2 — Media library hardening (2026-03-28)

**Status:** Implemented and verified.

### Scope

- Canonical `media_items` + `resolveMedia` variant option + `resolveBlockMediaDeep` `mediaVariantKey` passthrough.
- API: `displayName` / `metadata.variants` on POST/PATCH/upload; `MEDIA_API_CONTRACT.md` aligned with upload + DELETE.
- Mediearkiv UI: `getMediaDisplayName`, search by display name, tech line (mime / bytes / dimensions), navn fields on add/upload/cards.
- Docs: `MEDIA_SOURCE_OF_TRUTH.md`, `MEDIA_DATA_MODEL.md`, `MEDIA_READ_WRITE_FLOW.md`, `MEDIA_VARIANTS_AND_RESOLUTION.md`, `MEDIA_EDITOR_RUNTIME.md`, `AI_MEDIA_BOUNDARY.md`, PHASE2B_* updates.

### Gates (2B2)

- `npm run typecheck` — PASS
- `npm run build:enterprise` — PASS (exit 0; Next compile + SEO scripts)

### Tests added/updated

- `tests/lib/media/variantResolution.test.ts`
- `tests/lib/media/getMediaDisplayName.test.ts`
- `tests/cms/resolveBlockMediaDeep.test.ts`
- `tests/api/mediaItemsId.test.ts` — PATCH `displayName`, `metadata.variants`

---

## Earlier: Phase 2B planning closure

Discovery-only notes and initial `docs/phase2b/*` planning files remain relevant for media (2B2) and boundaries.
