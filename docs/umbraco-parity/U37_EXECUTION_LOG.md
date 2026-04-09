# U37 Execution Log

## 2026-03-31
- Created the initial U37 steering docs.
- Locked the first implementation set to four concrete closures:
  - publish audit action contract
  - `system_settings` baseline truth and management route ownership
  - `esg_monthly` schema drift fallback
  - duplicate block catalog/create truth removal

## Current Focus
- Runtime first, then editor/catalog convergence, then management posture polish, then tests and gates.

## Runtime Closures Landed
- Publish route now writes the DB-valid audit action `publish`.
- `system_settings` moved to one canonical baseline reader and one backoffice read route.
- ESG latest-monthly now supports canonical count columns and legacy meal columns through one normalized read path.
- Tree/audit degraded handling now exposes explicit operator payloads, technical code and schema detail.

## Editor / Compat Work Landed
- Added canonical backoffice block catalog from plugins.
- Moved block create options, block picker and `createBlock()` to the same catalog truth.
- Removed `blockRegistry.ts` after moving all code-paths away from it.

## Verification
- Focused U37 regression suite passed.
- Full `typecheck`, `lint`, `build:enterprise` and `test:run` passed.
- `sanity:live` returned soft-pass warning because no local server was running on `localhost:3000`.

## Guardrails
- No parallel editor/settings/runtime engines.
- No fake CRUD for code-governed objects.
- Degraded states must stay explicit and operator-useful.
