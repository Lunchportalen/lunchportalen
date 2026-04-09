# Content tree — data model (Phase 2B)

## Owner table

**`content_pages`** owns the persisted hierarchy. There is no separate “tree” entity.

## Columns (tree-relevant)

Defined in migration `supabase/migrations/20260320000000_content_tree_persistence.sql` (and follow-ups if any):

| Column | Role |
|--------|------|
| `tree_parent_id` | UUID FK → `content_pages.id` or `NULL` for roots under a virtual bucket |
| `tree_root_key` | Discriminator for which **virtual root** the page belongs to (e.g. site pages vs overlays) |
| `tree_sort_order` | Sibling ordering (integer) |

Constraint `content_pages_tree_placement_check` enforces valid combinations of `tree_parent_id` and `tree_root_key` (roots must not violate bucket rules).

## Virtual roots

The API builds a **synthetic tree** for the editor: folders like overlays / global / design are not necessarily separate tables; they are **virtual nodes** with stable string ids, backed by `tree_root_key` and/or naming conventions. See `app/api/backoffice/content/tree/route.ts` for the exact mapping.

## Slug / path

- **Canonical URL truth** for published pages remains whatever `content_pages` + slug logic already implements (public routing, preview).
- Tree placement (`tree_parent_id`, `tree_sort_order`) is **navigation/editor structure**; changing parent may or may not imply slug changes — **Phase 2B implementation must reuse existing slug/path rules** and avoid ad hoc client slug rewrites.

## Recycle / soft-delete (if present)

If recycle-bin or archived pages exist, they must be represented as **status or flags** on `content_pages` (or linked table already in use), not a second tree. Confirm against migrations and `docs/CONTENT_TREE_TRUTH.md`.

## API surface (read)

- `GET /api/backoffice/content/tree` → `{ ok, rid, data: { roots } }` (see route implementation for shape).

## API surface (write)

- `POST /api/backoffice/content/tree/move` → reorder / reparent with cycle detection and bucket rules.

## What is not in the DB as a separate model

- No `content_tree_nodes` shadow table for Phase 2B.
- Mock data in `app/(backoffice)/backoffice/content/_tree/treeMock.ts` is **UX/dev only** until the client loads from `GET /api/backoffice/content/tree`.
