-- Sentinel row only — DDL + ledger are applied by seed-environment-sentinel.mjs (B-only bootstrap).
-- REQUIRES EXPLICIT OWNER GO before running on prod:
--   node scripts/db/seed-environment-sentinel.mjs --expect production

INSERT INTO _meta.environment (key, value)
VALUES ('name', 'production')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      seeded_at = now();
