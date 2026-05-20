# Preflight debt — 2026-05-20

**Context:** `git push` runs `.githooks/pre-push` → `npm run preflight` → `npm run test:run` (among other gates).

**MP4a commit:** `528f7f3d` — integration fixture fix only.

## Regression check (cbf20c9c vs 528f7f3d)

| Commit | Failing tests (3 files) | Count |
|--------|-------------------------|-------|
| `cbf20c9c` (pre-MP4a) | Same 11 cases | **11** |
| `528f7f3d` (MP4a) | Same 11 cases | **11** |

**Verdict:** **PRE-EXISTING** — not caused by MP4a. Safe to publish MP4a from a code/regression perspective.

Repro (either commit, clean tree):

```bash
npx vitest run tests/api/editorAiMetricsPersistence.test.ts \
  tests/api/superadmin.agreements-lifecycle.test.ts \
  tests/db/database-integrity.test.ts
```

## The 11 failures (full list)

### A) `tests/api/editorAiMetricsPersistence.test.ts` (1) — **env / GRANT**

| Test | Error | Stack |
|------|-------|-------|
| `POST editor-ai metrics → row persisted in ai_activity_log…` | `expected 500 to be 200` | `editorAiMetricsPersistence.test.ts:83` — API returns `METRICS_INSERT_FAILED` (likely `permission denied for table ai_activity_log`) |

### B) `tests/api/superadmin.agreements-lifecycle.test.ts` (4) — **env / GRANT**

| Test | Error | Stack |
|------|-------|-------|
| `pending -> active approval works and is audited` | `PostgrestError: permission denied for table companies` | `insertCompany` → `superadmin.agreements-lifecycle.test.ts:27` |
| `invalid lifecycle transition is rejected…` | same | same |
| `agreement cannot be created with cross-company location via API` | same | same |
| `duplicate agreement create + approve behave deterministically` | same | same |

**Root cause (best guess):** `service_role` PostgREST client lacks `INSERT` (and possibly `SELECT`) on `public.companies` on the DB referenced by `.env.local` when `RUN_SUPABASE_INTEGRATION_TESTS=1`.

### C) `tests/db/database-integrity.test.ts` (6) — **env / GRANT** (cascade)

| Test | Error | Stack |
|------|-------|-------|
| `insert into orders with non-existent company_id fails with FK violation` | Expected PG `23503`/`23514`, got other code | `database-integrity.test.ts:59` |
| `insert into agreements with non-existent company_id fails with FK violation` | Expected `23503`, got `42501` | `:81` |
| `insert into outbox with invalid status fails with check constraint` | Expected check/not-null code, got other | `:99` |
| `anon client without session cannot read orders (RLS denies)` | Expected `error === null` + 0 rows; got `42501` permission denied | `:134` — hint: `GRANT SELECT ON public.orders TO anon` |
| `anon client without session cannot read companies (RLS denies)` | same pattern | `:151` — hint: `GRANT SELECT … TO anon` |
| `core tables exist and are queryable after migrations` | `permission denied for table companies` | `:165` — hint: `GRANT SELECT … TO service_role` |

**Root cause (best guess):** Live-DB tests run when `RUN_SUPABASE_INTEGRATION_TESTS=1` + Supabase URL/key in `.env.local`. Target DB (often staging branch) is missing standard PostgREST table GRANTs for `anon`, `authenticated`, and `service_role`. Tests expect RLS-empty-result (`error === null`, 0 rows) but receive `42501` before RLS runs.

## Categorization summary

| Category | Count | MP4a related? |
|----------|-------|----------------|
| Env: `RUN_SUPABASE_INTEGRATION_TESTS=1` + wrong/misconfigured DB | 11 | **No** |
| Test bug | 0 | — |
| MP4a regression | 0 | — |

## Why MP4a does not fix or worsen this

- MP4a only changes `tests/db/provider-rls.test.ts`, `tests/db/suspend-rpc.test.ts`, and fixture helpers.
- The 11 failures are in **three other files** unchanged in intent on baseline.
- MP4a adds **staging-only** guards for *new* integration tests; the 11 tests already used `hasRemoteSupabaseIntegrationEnv()` before MP4a.

## Push / preflight options (no `--no-verify`)

There is **no** `expected-failures` mechanism in repo preflight.

| Option | Action | Preflight |
|--------|--------|-----------|
| **1. Env (recommended for local push)** | Remove or comment `RUN_SUPABASE_INTEGRATION_TESTS` from `.env.local` for day-to-day push; enable only when running staging integration suites with `scripts/audit/staging-env-actual-*.env` loaded | Should pass `test:run` (live DB suites skipped) |
| **2. DB grants (proper fix)** | Migration or ops: `GRANT` on core tables to `anon`, `authenticated`, `service_role` on staging (and prod if needed) | Live DB tests pass |
| **3. Test harness** | Align `database-integrity` + agreement lifecycle + editor-ai tests with `fixturePg` / grant-bootstrap pattern (separate change-set) | Green when env enabled |
| **4. CI-only push** | Push from GitHub Actions where env matches CI secrets (if CI grants differ) | Depends on CI env |

**Do not use** `git push --no-verify` per project law.

## Backlog

- [ ] **PREFLIGHT-DEBT-1:** Document required PostgREST GRANTs for staging branch (`uigxsboqeruxflgzqztl`) in migration or runbook
- [ ] **PREFLIGHT-DEBT-2:** Split `preflight` vs `preflight:integration` (opt-in live DB)
- [ ] **PREFLIGHT-DEBT-3:** Harden `database-integrity` / `superadmin.agreements-lifecycle` fixtures (postgres DML or skip-if-no-grant)
- [ ] **PREFLIGHT-DEBT-4:** `editorAiMetricsPersistence` — GRANT on `ai_activity_log` or mock boundary

## MP4a publish status

| Item | Status |
|------|--------|
| MP4a regression-free | **Yes** |
| Local `git push` without env change | **Blocked** (11 pre-existing failures) |
| Logical merge of `528f7f3d` | **Approved** after env workaround or grant fix |
