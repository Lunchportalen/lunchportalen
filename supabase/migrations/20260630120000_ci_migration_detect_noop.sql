-- HOTFIX-C CI probe: idempotent no-op for migration detect + staging apply smoke.
-- Safe to apply once; documents ledger entry for CI verification only.
DO $$ BEGIN NULL; END $$;
