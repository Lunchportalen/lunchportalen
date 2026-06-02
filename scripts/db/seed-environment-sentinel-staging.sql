-- One-time bootstrap: uigx staging (uigxsboqeruxflgzqztl)
-- Requires 20260701120000_meta_environment_sentinel.sql applied first.
-- Use guarded seed path (ref-verified bootstrap):
--   node scripts/db/seed-environment-sentinel.mjs --expect staging

INSERT INTO _meta.environment (key, value)
VALUES ('name', 'staging')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      seeded_at = now();
