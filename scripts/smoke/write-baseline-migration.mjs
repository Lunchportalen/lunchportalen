import fs from "fs";

const header = `-- =============================================================================
-- BASELINE: prod schema snapshot (read-only pg_dump 2026-05-30)
-- Version 20260528000000 — frozen prod truth before forward pack (> 20260528143000)
--
-- REPLAY_SKIP (12 lines): ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin are
-- prefixed with "-- REPLAY_SKIP" because session pooler postgres cannot set
-- supabase_admin default ACLs on scratch/staging apply. Prod platform owns those;
-- object-level GRANT (863) / REVOKE (82) remain active in this migration.
--
-- Operational supplement (end of file): auth.on_auth_user_created + pg_cron job
-- ensure_audit_log_partitions_monthly (prod-equivalent).
-- =============================================================================

`;

let body = fs.readFileSync(".backups/prod-baseline-2026-05-30.sql", "utf8");
body = body.replace(/^\uFEFF/, "");
const out = "supabase/migrations/20260528000000_baseline_prod_schema.sql";
fs.writeFileSync(out, header + body, { encoding: "utf8" });
console.log("wrote", out, "bytes", fs.statSync(out).size);
