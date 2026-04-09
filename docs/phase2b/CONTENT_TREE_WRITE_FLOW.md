# Content tree — write flow (Phase 2B1)

## Move / reorder

- **UI:** `ContentTreeMoveDialog` — user picks a **target** (virtual root `overlays` | `global` | `design`, or a **page** UUID). Self and descendants of the moving page are excluded.
- **API:** `POST /api/backoffice/content/tree/move` with:
  - `page_id` (UUID)
  - Either `parent_page_id` + omitted `root_key`, or `parent_page_id: null` + `root_key` in `{ home, overlays, global, design }`
  - `sort_order` — append = `max(sibling.treeSortOrder)+1` among children of the target, computed client-side from the last loaded tree (`computeAppendSortOrder`).
- **After success:** `loadTree()` refetches so UI matches DB.

## Create child

- **Under virtual folder** (`overlays`, `global`, `design`): `POST /api/backoffice/content/pages` with `{ title: "Ny side", tree_root_key: "<folder>" }`.
- **Under a page (UUID):** `{ title: "Ny side", tree_parent_id: "<uuid>" }`.
- **Not allowed from UI:** create under virtual **Hjem** (`home`) — fixed app surfaces are managed elsewhere.
- **Default root** when API is called without placement (e.g. other clients): `tree_root_key` defaults to **`overlays`** server-side.

## Rename

- **UUID pages only:** `PATCH /api/backoffice/content/pages/[id]` with `{ title }`, then `loadTree()`.
- **Fixed system pages** (`employee_week`, `superadmin`, etc.): rename/move/create disabled in UI via `permissionsForNode`.

## Delete

- **Out of scope for 2B1:** no `DELETE` route wired from tree; `canDelete` is always **false** in the tree.

## Server: POST create placement

- `app/api/backoffice/content/pages/route.ts` computes `tree_sort_order` via `nextTreeSortOrder()` so new rows satisfy the placement constraint.
