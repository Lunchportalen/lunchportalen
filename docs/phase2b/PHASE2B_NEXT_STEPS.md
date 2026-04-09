# Phase 2B — Next steps

## Done (2B1)

- **Step A — Read path:** `ContentTree` loads `GET /api/backoffice/content/tree`, maps via `mapTreeApiRoots.ts`, expands path to selection.
- **Step B — Write path:** Create (`POST /pages` with tree fields), rename (`PATCH` title), move (`ContentTreeMoveDialog` + `POST .../tree/move`), refetch after mutations.
- **Gates:** `typecheck`, `lint`, `build:enterprise` green after changes.

## Done (2B2) — Media library hardening

- `docs/MEDIA_API_CONTRACT.md` aligned with `upload/route.ts`, `DELETE`, `displayName`, `variants`.
- Mediearkiv + `resolveMedia` / `resolveBlockMediaDeep` / `metadata.variants` + `mediaVariantKey`.
- Phase 2B2 documentation set under `docs/phase2b/MEDIA_*.md`.

## Next: Phase 2C (not started)

- Per product roadmap — **not** in scope here: SEO/social/ESG runtimes, control towers, tenant media RLS, storage GC on delete.

## Later (optional)

- Tree delete: safe `DELETE` or `archived` flag + guardrails for block references.
- Sibling reorder within same parent (swap `tree_sort_order` without opening move dialog).
- Inspector field for `mediaVariantKey` where product wants explicit variant selection.
- Storage cleanup job for orphaned objects after `media_items` delete.

## Tree vs media

**2B1** tree and **2B2** media are documented in `docs/phase2b/`; boundaries in `PHASE2B_BOUNDARIES.md`.
