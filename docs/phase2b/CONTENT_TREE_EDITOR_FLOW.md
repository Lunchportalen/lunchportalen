# Content tree — editor flow (Phase 2B)

## Actors

- **Editor** (backoffice, superadmin-scoped per current API guards).
- **Browser:** left sidebar `ContentTree`, workspace main area for selected page.

## Target flow (canonical)

1. **Load:** On workspace mount (or tree panel mount), `GET /api/backoffice/content/tree` builds the tree from `content_pages` + virtual roots.
2. **Select:** Clicking a **page** node sets selection and navigates to `/backoffice/content/[id]` (or equivalent) — **server loads page**; tree highlights selection from route.
3. **Expand/collapse:** Pure client state (`expandedIds`); no API.
4. **Move / reorder:** User opens move UI → `POST /api/backoffice/content/tree/move` with `{ page_id, parent_page_id | null, root_key, sort_order }` (exact body per route) → server validates → tree refetched or optimistically updated.
5. **Create page:** Must go through **existing page-creation API** that inserts `content_pages` with correct `tree_*` fields — **not** client-only `addChildToTree` without persistence.

## Current implementation gap (as of discovery)

`ContentTree.tsx` uses:

- `useState(getMockRoots)` — **mock roots on every load**
- Local helpers (`addChildToTree`, `removeNodeFromTree`, etc.) for create/rename/delete

**There is no `useEffect` that fetches `/api/backoffice/content/tree`.**  
So the **editor UX can diverge from database truth** until wired.

`docs/CONTENT_TREE_TRUTH.md` describes persisted behavior; **the workspace component must be aligned** in implementation phase.

## Distinct: block structure tree

`EditorStructureTree.tsx` (and related) is the **within-page block order** tree. It is **not** the site content tree. Phase 2B must not merge the two concepts in the data model.

## Preview / publish coupling

- Selecting a page triggers normal workspace load → preview uses same blocks as publish.
- Tree changes that **only** reorder siblings **must not** invalidate published URLs unless slug rules say so (fail-closed: document behavior in implementation PR).

## Permissions UI

`getNodePolicy` / `permissionsForNode` in `ContentTree.tsx` express **Home** hard locks. Persisted implementation must keep the same product rules (Home not deletable, etc.) **enforced server-side** in move/create/delete APIs.
