# uigx re-seed chain (E2E + smoke)

**Target:** Supabase scratch `uigxsboqeruxflgzqztl` only. Never prod (`hkpokyapzarefrgqzkos`).

## CI E2E (self-contained — no manual DB prerequisite)

`.github/workflows/ci-e2e.yml` runs the **full idempotent chain** on every E2E job, after the uigx URL guard and before Playwright:

1. Verify staging seed secrets (`SUPABASE_STAGING_PROJECT_REF`, `SUPABASE_STAGING_DB_PASSWORD`, `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_ANON_KEY`, `SUPABASE_STAGING_SERVICE_ROLE_KEY`).
2. Build `STAGING_DATABASE_URL` / `DATABASE_URL` (session pooler) — **same pattern as** `supabase-migrate.yml` staging job.
3. `psql "$STAGING_DATABASE_URL" -f scripts/smoke/seed-staging-tenant.sql`
4. `node scripts/smoke/seed-smoke-menu-fixture.mjs`
5. `node scripts/smoke/seed-e2e-users.mjs` (requires all 8 `E2E_*` repo secrets)

The job survives a uigx wipe without manual re-seed. Migrations are **not** applied in CI E2E (assumes uigx schema already matches repo; migrate workflow owns `db push`).

**Thomas must set repo secrets:** 5 staging Supabase + **8 `E2E_*`** (see secret contract in E2E coverage docs). Until `E2E_*` exist, the job fails at bootstrap with a named missing secret — not false-green.

## Local / manual order (same semantics)

1. Apply migrations (`supabase db push` on uigx) if schema drifted.
2. `scripts/smoke/seed-staging-tenant.sql` (via `psql` + uigx `DATABASE_URL`).
3. `node scripts/smoke/seed-smoke-menu-fixture.mjs`
4. `node scripts/smoke/seed-e2e-users.mjs` (requires `E2E_*` in `.env.local`).

Optional ops smoke (not required for Playwright auth suite):

- `node scripts/smoke/provision-smoke-user.mjs` — legacy `smoke-test@lunchportalen.no` (separate from E2E canonical users).
- `node scripts/smoke/stage4-uigx-kitchen-driver-seed.mjs` — kitchen/driver harness data.

## Supabase env for E2E app + seed

CI uses **staging** GitHub secrets (`SUPABASE_STAGING_*`), not prod `NEXT_PUBLIC_SUPABASE_URL`.
