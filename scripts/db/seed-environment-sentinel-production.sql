-- One-time bootstrap: production (hkpokyapzarefrgqzkos)
-- REQUIRES EXPLICIT OWNER GO before running on prod.
-- Requires 20260701120000_meta_environment_sentinel.sql applied first.
-- Use guarded seed path (ref-verified bootstrap):
--   node scripts/db/seed-environment-sentinel.mjs --expect production

INSERT INTO _meta.environment (key, value)
VALUES ('name', 'production')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      seeded_at = now();
