# U31R Execution Plan

- Title: U31R CMS editor recovery, file placement audit, and Bellissima build
- Scope: `app/(backoffice)/backoffice/content/**`, `app/(backoffice)/backoffice/settings/**`, `app/api/backoffice/content/**`, `lib/cms/**`, shared backoffice shell/nav files, and focused CMS tests.
- Repro:
  1. Open `app/(backoffice)/backoffice/content/page.tsx`.
  2. Observe IDE errors for `../_workspace/ContentEditor` and `../_components/CreateMissingPageClient`.
  3. Open `app/api/backoffice/content/tree/route.ts` and observe the type error at `fetched.error`.
  4. Open the content editor flow and note split status rows, weak tree primacy, dense inspector, and small preview relative to the editor canvas.
- Expected: `/backoffice/content` owns the section overview, `/backoffice/content/[id]` owns the detail editor, tree and audit degrade honestly, and the editor layout reads as section -> tree -> workspace -> views/actions/footer.
- Actual: the content section root duplicates detail-route logic, imports non-existent relative files, the tree route has a discriminated-union type issue, and Bellissima parity is still fragmented across top chrome, tri-pane layout, history, and settings.
- Root cause: route ownership drift, stale relative imports, partial runtime-degradation wiring, and accumulated UI layering inside the content workspace.
- Fix: restore canonical file ownership, repair the import graph, harden tree/audit degraded behavior, and simplify the backoffice/editor structure without introducing new engines or parallel systems.
- Verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build:enterprise`
  - `npm run sanity:live`
  - `npm run test:run`

## Frozen Flow Check

- No frozen company lifecycle flow is touched.
- No onboarding, auth, billing, employee week, driver, or kitchen runtime truth is being changed.
- Backoffice CMS and settings are the active scope; any adjacent surface is read-only context unless directly required for editor recovery.

## Impacted Flows

- `/backoffice/content`
- `/backoffice/content/[id]`
- `/backoffice/content/recycle-bin`
- `/backoffice/settings`
- `/backoffice/settings/document-types`
- `/backoffice/settings/data-types`
- `/backoffice/settings/create-policy`
- `/api/backoffice/content/tree`
- `/api/backoffice/content/audit-log`
- `/api/backoffice/content/pages`

## Gate Target

- `typecheck`
- `lint`
- `build:enterprise`
- `sanity:live`
- `test:run`
