# uigx re-seed chain (E2E + smoke)

**Target:** Supabase scratch `uigxsboqeruxflgzqztl` only. Never prod (`hkpokyapzarefrgqzkos`).

## Order (reproducible)

1. Apply migrations (`supabase db push` / CI `supabase-migrate` on staging ref).
2. `scripts/smoke/seed-staging-tenant.sql` — A6 company, location, agreement, providers.
3. `node scripts/smoke/seed-smoke-menu-fixture.mjs` — menu for DC-011 / week flows.
4. `node scripts/smoke/seed-e2e-users.mjs` — four E2E auth users + profiles (requires `E2E_*` env).

Optional ops smoke (not required for Playwright auth suite):

5. `node scripts/smoke/provision-smoke-user.mjs` — legacy single `smoke-test@lunchportalen.no` (separate from E2E canonical users).
6. `node scripts/smoke/stage4-uigx-kitchen-driver-seed.mjs` — kitchen/driver harness data.

## CI E2E

`.github/workflows/ci-e2e.yml` runs step 4 automatically after bootstrap secrets, before Playwright.

Supabase env for the E2E job uses **staging** GitHub secrets (`SUPABASE_STAGING_*`), not prod `NEXT_PUBLIC_SUPABASE_URL`.
