#!/usr/bin/env node
/**
 * One-shot: archive subsumed migrations; keep baseline + 16 forwards only.
 * Run from repo root: node scripts/smoke/squash-archive-migrations.mjs
 */
import fs from "fs";
import path from "path";

const MIG = "supabase/migrations";
const ARCH = path.join(MIG, "_archive");

const KEEP = new Set([
  "20260528000000_baseline_prod_schema.sql",
  "20260529120000_tpt_b2_flow_b_mapping.sql",
  "20260530120000_tpt_b3_agreement_invoices.sql",
  "20260530123000_tg_orders_hydrate_provider_id.sql",
  "20260531120000_tpt_b5_billing_scheduler.sql",
  "20260601120000_tpt_b6_webhook_paid_status.sql",
  "20260602120000_tpt_b5b_agreement_lifecycle_hooks.sql",
  "20260603120000_tpt_b7_foundation.sql",
  "20260603120100_tpt_b7_foundation_fix.sql",
  "20260604120000_tpt_b7_hotfix_guard_order.sql",
  "20260605120000_tpt_b7_hotfix5_verify_audit_diag.sql",
  "20260606120000_tpt_b7_hotfix6_outbox_grants.sql",
  "20260607120000_tpt_b7_hotfix8_service_role_grants.sql",
  "20260608120000_tpt_b7_polish9_webhook_subscriptions.sql",
  "20260609120000_dc018_enable_rls_billing.sql",
  "20260609130000_dc019_enable_rls_tenant_tables.sql",
  "20260609150000_revoke_internal_rpc_execute_lockdown.sql",
]);

fs.mkdirSync(ARCH, { recursive: true });

const files = fs.readdirSync(MIG).filter((f) => f.endsWith(".sql"));
let moved = 0;
for (const f of files) {
  if (KEEP.has(f)) continue;
  const src = path.join(MIG, f);
  const dst = path.join(ARCH, f);
  if (fs.existsSync(dst)) fs.unlinkSync(dst);
  fs.renameSync(src, dst);
  moved++;
}

const remaining = fs.readdirSync(MIG).filter((f) => f.endsWith(".sql"));
const archived = fs.readdirSync(ARCH).filter((f) => f.endsWith(".sql"));

console.log("MOVED_TO_ARCHIVE", moved);
console.log("MIGRATIONS_REMAINING", remaining.length, remaining.sort().join(", "));
console.log("ARCHIVE_COUNT", archived.length);

if (remaining.length !== 17) {
  console.error("ABORT: expected 17 migration files, got", remaining.length);
  process.exit(1);
}
