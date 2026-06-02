-- Record repo migration in ledger after B-only bootstrap (idempotent).
-- Version/name must match supabase/migrations/20260701120000_meta_environment_sentinel.sql

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260701120000', 'meta_environment_sentinel')
ON CONFLICT (version) DO NOTHING;
