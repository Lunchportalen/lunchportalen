# Content tree — runtime plan (Phase 2B)

## 1. Current inventory

| Layer | Location | Notes |
|-------|----------|--------|
| DB | `20260320000000_content_tree_persistence.sql` | `tree_parent_id`, `tree_root_key`, `tree_sort_order` |
| Read API | `app/api/backoffice/content/tree/route.ts` | Builds tree for editor |
| Write API | `app/api/backoffice/content/tree/move/route.ts` | Move/reorder with validation |
| Truth doc | `docs/CONTENT_TREE_TRUTH.md` | Intended behavior / limits |
| UI | `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx` | **Uses `getMockRoots()`** |
| Mock | `treeMock.ts`, `treeTypes.ts` | Dev/UX scaffolding |
| Rows | `TreeNodeRow.tsx`, `NodeActionsMenu.tsx` | Presentation + actions |

## 2. Problem statement

**Persistence exists server-side; the primary tree UI is not yet driven by it.**  
Phase 2B implementation must **wire** the editor to the existing APIs and **remove or gate** mock mutations so there is **one** story: DB → GET tree → UI → POST move / create via real endpoints.

## 3. Non-goals

- New parallel tree storage or v2 routes.
- Changing public routing or middleware for non-CMS areas.
- SEO/social/ESG pipelines.

## 4. Implementation phases (suggested order)

1. **Read path:** Replace initial state with `GET /api/backoffice/content/tree` (loading/error states, refetch on focus optional).
2. **Selection sync:** Derive selected node from `pathname` + API ids; ensure virtual folder ids remain stable.
3. **Move:** Wire move modal / drag-drop (if present) to `POST .../tree/move`; refetch tree on success.
4. **Create / rename / delete:** Replace mock mutations with calls to existing **page** CRUD routes that set `tree_*` correctly (add routes only if missing — minimal).
5. **Tests:** API integration tests for cycle prevention and bucket rules; smoke test for tree load in workspace.

## 5. Preview / render / publish

- No separate tree renderer: published pages resolve by slug/page id as today.
- Verify after wiring: moving a page does not break `resolveMedia` or block bodies (orthogonal, but regression-test).

## 6. Design scope (2A)

- Tree panel styling may use existing tokens; no new global CSS system.
