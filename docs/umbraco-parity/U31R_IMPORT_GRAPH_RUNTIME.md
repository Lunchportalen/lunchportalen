# U31R Import Graph Runtime

- Title: Restore canonical content route ownership and import graph
- Scope: `app/(backoffice)/backoffice/content/page.tsx`, `app/(backoffice)/backoffice/content/[id]/page.tsx`, `app/(backoffice)/backoffice/content/_workspace/ContentDashboard.tsx`, and the route smoke test.
- Repro:
  1. Open `app/(backoffice)/backoffice/content/page.tsx`.
  2. Observe stale relative imports to `../_workspace/ContentEditor` and `../_components/CreateMissingPageClient`.
  3. Compare with `app/(backoffice)/backoffice/content/[id]/page.tsx`, which already owns UUID/slug editor logic.
- Expected: `/backoffice/content` owns the section overview only, while `/backoffice/content/[id]` is the single owner of editor and missing-node recovery.
- Actual: the section root had drifted into detail-route behavior and imported files that did not exist at those relative paths.
- Root cause: route ownership drift between section overview and detail editor, not a missing file on disk.
- Fix: `content/page.tsx` now imports only `./_workspace/ContentDashboard`, while `content/[id]/page.tsx` remains the sole owner of `ContentEditor` and `CreateMissingPageClient`.
- Verification:
  - `tests/backoffice/content-page-smoke.test.tsx`
  - `npm run typecheck`
  - `npm run build:enterprise`

## Canonical Runtime Graph

| Route | Owning file | Runtime surface | Post-U31R posture |
| --- | --- | --- | --- |
| `/backoffice/content` | `app/(backoffice)/backoffice/content/page.tsx` | `ContentDashboard` | Section overview only |
| `/backoffice/content/[id]` with UUID | `app/(backoffice)/backoffice/content/[id]/page.tsx` | `ContentEditor` | Canonical editor entry |
| `/backoffice/content/[id]` with unresolved slug | `app/(backoffice)/backoffice/content/[id]/page.tsx` | `CreateMissingPageClient` | Fail-closed recovery surface |

## Import Decisions Locked By U31R

- `ContentEditor` stays under `content/_workspace`, but it is no longer imported from the section root.
- `CreateMissingPageClient` stays local to `content/[id]/_components`, where unresolved slug recovery belongs.
- No new barrel, alias route, or parallel editor entry point was introduced.
- `ContentDashboard` now makes the root route self-descriptive by stating tree-first navigation, workspace posture, and degraded-state honesty.
