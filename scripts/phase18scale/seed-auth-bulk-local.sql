-- PHASE 18SCALE — local-only bulk auth helper (run via psql against local DB).
-- Creates auth users p18scale-emp-NNNNNN@load.lunchportalen.test with known password hash placeholder.
-- Prefer seed-scale-matrix.mjs for portable seeding; use this only on local Docker for speed.

-- Example invocation (local):
--   docker exec -i supabase_db_lunchportalen psql -U postgres -d postgres < scripts/phase18scale/seed-auth-bulk-local.sql
--
-- NOTE: Full password hashing for GoTrue is handled by seed-scale-matrix.mjs / Auth Admin API.
-- This file documents the intended bulk path and creates supporting indexes only.

CREATE INDEX IF NOT EXISTS idx_profiles_email_p18
  ON public.profiles (email)
  WHERE email LIKE 'p18scale-%';

CREATE INDEX IF NOT EXISTS idx_companies_contact_email_p18
  ON public.companies (contact_email)
  WHERE contact_email LIKE 'p18scale-%';

CREATE INDEX IF NOT EXISTS idx_providers_slug_p18
  ON public.providers (slug)
  WHERE slug LIKE 'p18scale-%';
