# Content tree — source of truth (Phase 2B1)

## Canonical model

- **`content_pages`** is the only persisted tree carrier.
- Placement columns (DB): `tree_parent_id`, `tree_root_key`, `tree_sort_order` with constraint `content_pages_tree_placement_check` (either root-level under a virtual bucket, or nested under a parent page).

## API (authoritative read/write)

| Operation | Route |
|-----------|--------|
| Read tree for editor | `GET /api/backoffice/content/tree` |
| Move / reorder placement | `POST /api/backoffice/content/tree/move` |
| Create page (with tree placement) | `POST /api/backoffice/content/pages` — body may include `tree_parent_id` **or** `tree_root_key` (not both) |
| Rename (title) | `PATCH /api/backoffice/content/pages/[id]` — `{ title }` |

## UI (implemented in 2B1)

- **`ContentTree.tsx`** loads `GET /api/backoffice/content/tree` on mount, maps JSON via `parseTreeRootsFromJsonResponse` (`mapTreeApiRoots.ts`), dedupes with `dedupeRootsById`.
- **Removed as default data source:** `getMockRoots()` is no longer used to populate the live tree (still available in `treeMock.ts` for tests / legacy helpers).

## Mock / legacy helpers retained

| Artifact | Role |
|----------|------|
| `treeMock.ts` — `getMockRoots`, `getMockRoot` | Optional fixtures for unit tests; not wired to production tree load |
| `treeMock.ts` — `findNode`, `flattenVisible`, `dedupeRootsById`, `collectDescendantIds` | Pure helpers on API-shaped trees |
| `MOCK_RECYCLE_BIN_ID` | Recycle Bin row remains a UI affordance; not backed by tree API in 2B1 |

## What was removed from editor behavior

- Client-only **create** (random id + `addChildToTree`) — replaced by `POST /api/backoffice/content/pages` with tree fields.
- Client-only **rename** (local `setRoots` map) — replaced by `PATCH` title + refetch tree.
- Client-only **delete** (`removeNodeFromTree`) — **not** reimplemented in 2B1; menu **Slett** stays disabled (`canDelete: false`).
- Client-only **move** (noop) — replaced by `ContentTreeMoveDialog` + `POST .../tree/move`.
