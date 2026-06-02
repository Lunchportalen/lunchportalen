-- Sentinel row only — DDL + ledger are applied by seed-environment-sentinel.mjs (B-only bootstrap).
--   node scripts/db/seed-environment-sentinel.mjs --expect staging

INSERT INTO _meta.environment (key, value)
VALUES ('name', 'staging')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      seeded_at = now();
