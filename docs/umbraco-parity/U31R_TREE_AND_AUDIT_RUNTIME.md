# U31R Tree And Audit Runtime

- Title: Harden tree and audit degraded runtime without inventing a new motor
- Scope: `app/api/backoffice/content/tree/route.ts`, `app/(backoffice)/backoffice/content/_tree/mapTreeApiRoots.ts`, `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx`, `app/api/backoffice/content/audit-log/route.ts`, `app/(backoffice)/backoffice/content/_components/ContentWorkspaceHistoryView.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspaceAuditTimeline.tsx`, and focused tests.
- Repro:
  1. Open `app/api/backoffice/content/tree/route.ts` and inspect `fetched.error`.
  2. Trigger or simulate schema drift in `content_pages` or missing `content_audit_log`.
  3. Open the editor and observe that tree and audit status previously surfaced as fragmented or generic warnings.
- Expected: tree and audit should stay honest, typed, and operator-readable when schema or table state is degraded.
- Actual: the tree route had a type-narrowing error, and degraded runtime signals were only partially mapped into the UI.
- Root cause: the degraded API contracts already existed, but their operator messages were not carried consistently through the client layers.
- Fix: the tree route now uses explicit discriminated-union narrowing, tree schema hints cover missing tree columns and missing tables, the tree UI renders explicit degraded badges, and the audit timeline/history view promote `historyStatus` and `operatorMessage` to first-class runtime signals.
- Verification:
  - `tests/cms/mapTreeApiRoots.test.ts`
  - `tests/api/contentAuditLogRoute.test.ts`
  - `npm run test:run`

## Tree Runtime Posture

- `app/api/backoffice/content/tree/route.ts` now uses `if (fetched.ok === false)` before reading `fetched.error`, which removes the union-type failure without changing runtime behavior.
- `app/(backoffice)/backoffice/content/_tree/mapTreeApiRoots.ts` maps `treeColumnsMissing` and `tableMissing` to explicit Norwegian operator hints.
- `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx` renders `Tree degradert` or `Schema-fallback` as visible status chips, plus a clear explanation that navigation is running in reserve mode.
- Empty tree state now points the operator at `content_pages` migration/schema issues instead of showing a misleading blank surface.

## Audit Runtime Posture

- `app/api/backoffice/content/audit-log/route.ts` continues to return HTTP 200 in degradable cases, but now carries explicit `historyStatus` and `operatorMessage` values for the workspace.
- `app/(backoffice)/backoffice/content/_components/ContentWorkspaceHistoryView.tsx` consolidates publish state, governance posture, and version/preview controls into one calmer history zone.
- `app/(backoffice)/backoffice/content/_components/ContentWorkspaceAuditTimeline.tsx` surfaces:
  - `surfaceMessage` for operator context
  - `source` when the route provides it
  - separate chips for history status and audit health
- U31R does not replace the audit subsystem. It exposes existing degraded truth more honestly.

## Runtime Contract Notes

- Tree degraded reasons now map cleanly from API to UI:
  - `TABLE_OR_CONTENT_PAGES_UNAVAILABLE`
  - `TREE_COLUMNS_MISSING`
  - `PAGE_KEY_COLUMN_MISSING`
- Audit degraded responses remain within the locked API success envelope and describe the failure as degraded, not successful and not fatal.
