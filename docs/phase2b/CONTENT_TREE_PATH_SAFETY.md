# Content tree — path / slug safety (Phase 2B1)

## Decision (2B1)

- **Tree move does not change `slug`.** `POST /api/backoffice/content/tree/move` only updates `tree_parent_id`, `tree_root_key`, and `tree_sort_order` (see `app/api/backoffice/content/tree/move/route.ts`).
- **Public URLs** for a page remain driven by `content_pages.slug` (and existing routing) — **unchanged** by reparenting in this phase.

## Why

- Avoiding hidden URL changes when editors reorganize the tree reduces risk to bookmarks, SEO, and cached links.
- Full “folder path reflects URL” semantics would require a dedicated design pass (slug uniqueness, redirects, audit).

## Create page

- New pages still get a **unique slug** from `POST /api/backoffice/content/pages` (slugify title or explicit `slug` body field) — same as before; tree placement is orthogonal.

## Deferred (later phase)

- Optional: auto-suggest slug from parent path, bulk redirect table, or validation when move implies marketing URL change — **not** implemented in 2B1.

## Editor copy

- `ContentTreeMoveDialog` states explicitly that slug/public URL is not altered by the move operation.
