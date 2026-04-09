# U32 - Tree and audit runtime

- Title: U32 tree and audit reliability hardening
- Scope: `app/api/backoffice/content/tree/route.ts`, `app/(backoffice)/backoffice/content/_tree/mapTreeApiRoots.ts`, `app/api/backoffice/content/audit-log/route.ts`, and focused tree/audit tests.
- Repro:
  1. Trigger degraded tree or audit states by simulating missing schema, missing table, or missing columns.
  2. Observe that degraded posture can become too generic or technically misleading.
- Expected: tree and audit stay stable when possible and degrade honestly with useful operator detail when not.
- Actual: degraded behavior existed, but operator messaging and reason classification were still not precise enough.
- Root cause: degraded payloads did not yet distinguish clearly between schema cache issues, missing columns, and genuine table absence across all paths.
- Fix: add operator-facing degraded payload detail, expose it all the way through UI parsers, and tighten audit classification so relation-missing maps to `TABLE_MISSING` instead of being blurred into schema-cache drift.
- Verification:
  - `npx vitest run tests/cms/mapTreeApiRoots.test.ts tests/api/contentAuditLogRoute.test.ts --config vitest.config.ts`
  - `npm run typecheck`
  - `npm run build:enterprise`

## Tree runtime changes

- `TreeFetchResult` now carries `operatorMessage`.
- degraded tree responses now include clearer reasons and human-readable operator posture.
- `mapTreeApiRoots.ts` now prioritizes `operatorMessage` so the UI receives the sharpest available degraded explanation.

## Audit runtime changes

- degraded audit responses now distinguish:
  - `COLUMN_MISSING`
  - `SCHEMA_CACHE_UNAVAILABLE`
  - `TABLE_MISSING`
- operator message and `schemaHints` are returned together with degraded empty-state responses.
- relation-missing errors now classify as table missing instead of schema cache failure.

## Result

- Tree and audit no longer fail open semantically when schema drift happens.
- Operators get clearer degraded truth instead of a blank or misleading surface.
- U32 improves honesty without inventing a new tree or history engine.
