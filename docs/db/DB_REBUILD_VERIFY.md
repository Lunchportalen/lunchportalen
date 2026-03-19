# Database rebuild and schema verification

**Purpose:** Verify that the database schema is fully reproducible: empty DB → run all migrations → schema matches expected structure.

## Commands

- **Full rebuild + verify (local Supabase):**  
  `supabase start` then `node scripts/ci/db-rebuild-verify.mjs`

- **Verify only (existing DB):**  
  `DATABASE_URL=postgresql://... node scripts/ci/db-rebuild-verify.mjs`  
  Requires `pg`: `npm i -D pg`

- **Migration gate only (no DB):**  
  `node scripts/ci/migration-gate.mjs`

## What the script does

1. **Migration gate** – Checks that all migration filenames match `<numericPrefix>_<name>.sql` and are in deterministic (sorted) order. Same-day prefixes are allowed.
2. **Rebuild** – Runs `supabase db reset` when Supabase CLI and local DB are available (Docker required). Otherwise skipped.
3. **Schema verification** – When a DB URL is available (after reset or via `DATABASE_URL`), checks:
   - Required tables exist (core + content + billing + outbox + etc.)
   - Required CHECK constraints: `company_deletions_mode_ck`, `outbox_status_check`
   - Required indexes: `profiles_company_id_idx`, `outbox_claim_idx`
   - Required function: `lp_order_set`

## Rebuild result (example run without Docker)

- **Migration gate:** PASS (57 migrations, deterministic order).
- **Rebuild:** FAIL – `supabase db reset` requires Docker (local Supabase). Error: `Docker Desktop is a prerequisite for local development`.
- **Schema verification:** SKIPPED – No DB URL (reset did not run; `DATABASE_URL` not set).

## Mismatches and fixes applied

- **Migration gate (historical):** The gate previously required *unique* numeric prefixes and *strictly increasing* order. The repo has multiple migrations per day (e.g. several `20260204_*`), so the gate was relaxed to:
  - Allow duplicate prefixes (same-day migrations).
  - Require only valid numeric prefix and sorted filename order (no numeric non-decreasing check), so application order is deterministic.
- **Rebuild on this machine:** To run a full rebuild, start Docker and run `supabase start`, then run the script again. For CI, use a Supabase project and `supabase db push` (see `.github/workflows/supabase-migrate.yml`).

## Final schema verification

When `DATABASE_URL` is set and `pg` is installed, the script connects and verifies:

- All required tables present.
- Key constraints and indexes present.
- No migration failures (inferred by presence of expected objects).

If any required table, constraint, or index is missing, the script exits with code 1 and lists mismatches.
