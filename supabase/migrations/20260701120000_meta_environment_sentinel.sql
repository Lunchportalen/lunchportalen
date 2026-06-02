-- Authoritative environment sentinel for fail-closed DB target guard
-- (scripts/ci/assert-db-target.mjs).
--
-- Idempotent (IF NOT EXISTS) — safe for CI db push re-apply after bootstrap.
-- Prod/staging first-time setup: scripts/db/seed-environment-sentinel.mjs --expect <env>
--   applies this DDL + sentinel seed + ledger record 20260701120000 in one B-only chain.

CREATE SCHEMA IF NOT EXISTS _meta;

CREATE TABLE IF NOT EXISTS _meta.environment (
  key text PRIMARY KEY CHECK (key = 'name'),
  value text NOT NULL CHECK (value IN ('staging', 'production')),
  seeded_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON SCHEMA _meta IS 'Internal operational metadata (environment sentinel, not app data).';
COMMENT ON TABLE _meta.environment IS
  'Exactly one row (key=name). Read by assert-db-target.mjs before any DB write.';
