# Content tree — read flow (Phase 2B1)

## Sequence

1. **Mount:** `ContentTree` calls `loadTree()` → `fetch("/api/backoffice/content/tree", { credentials: "include" })`.
2. **Parse:** Response must match `jsonOk`: `{ ok: true, rid, data: { roots } }`. Parsed with `parseTreeRootsFromJsonResponse`.
3. **Dedupe:** `dedupeRootsById` ensures at most one node per root id.
4. **Selection:** Effective selection = `selectedNodeId` prop **or** first path segment under `/backoffice/content/[id]`.
5. **Expand:** When `roots` or `selectedId` changes, `expandIdsForSelection` expands ancestors so the current page is visible (including **Hjem** when `selectedId === targetPageId` for the virtual home root).
6. **Virtual Hjem:** Clicking **Hjem** still resolves Forside via `GET /api/backoffice/content/home` (unchanged).

## Loading / error UX

- Initial load shows «Laster tre…» when empty.
- Failure shows message + **Prøv igjen** calling `loadTree()` again.

## API additions

- `GET /api/backoffice/content/tree` now includes `treeSortOrder` on **page** nodes (from `content_pages.tree_sort_order`) for client-side append ordering when moving.

## Not changed

- Public page resolution by slug — still outside this component.
- Preview/publish pipeline — unchanged; tree only affects navigation and placement in DB.
