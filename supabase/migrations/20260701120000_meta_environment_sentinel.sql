-- Authoritative environment sentinel for fail-closed DB target guard
-- (scripts/ci/assert-db-target.mjs). Seed value is applied once per project via
-- scripts/db/seed-environment-sentinel-{staging,production}.sql — not in this migration.

CREATE SCHEMA IF NOT EXISTS _meta;

CREATE TABLE IF NOT EXISTS _meta.environment (
  key text PRIMARY KEY CHECK (key = 'name'),
  value text NOT NULL CHECK (value IN ('staging', 'production')),
  seeded_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON SCHEMA _meta IS 'Internal operational metadata (environment sentinel, not app data).';
COMMENT ON TABLE _meta.environment IS
  'Exactly one row (key=name). Read by assert-db-target.mjs before any DB write.';
