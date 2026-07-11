#!/usr/bin/env node
/**
 * GLOBAL RELEASE GATE — production migration preflight (READ-ONLY, non-mutating).
 *
 * Verifies, without writing anything, that `supabase db push --include-all` will
 * apply exactly the expected migration set against the target database.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/ci/production-migration-preflight.mjs
 *
 * Checks:
 *   1. Connection is read-only safe (only SELECT queries are issued).
 *   2. Remote schema_migrations vs local supabase/migrations files:
 *      - expected missing set (the release plan) is printed in apply order
 *      - out-of-order detection (any missing version < max applied) => --include-all REQUIRED
 *   3. Pre-state invariants: billing-block tables absent-or-complete (no partial apply),
 *      auth hook function present, RLS enabled on core tenant tables.
 *   4. Fails closed on any unknown/unexpected state.
 *
 * This script NEVER executes DDL/DML. It can be pointed at prod safely.
 *
 * Optional: --report <path>  writes a full markdown preflight report
 * (all local migrations with applied/pending status + billing object expectations).
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const url = String(process.env.DATABASE_URL ?? "").trim();
if (!url) {
  console.error("FAIL: DATABASE_URL required (read-only preflight target)");
  process.exit(2);
}

const reportFlagIdx = process.argv.indexOf("--report");
const reportPath = reportFlagIdx > -1 ? String(process.argv[reportFlagIdx + 1] ?? "").trim() : "";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

const BILLING_BLOCK_TABLES = [
  "markets",
  "organization_billing_profiles",
  "payment_methods",
  "order_line_commercial_snapshots",
  "commission_rules",
  "commission_ledger",
  "commission_periods",
  "provider_commission_invoices",
  "invoice_deliveries",
  "billing_audit_log",
  "billing_readiness_events",
  "billing_payment_attempts",
  "stripe_billing_webhook_events",
];

const CORE_TENANT_TABLES = ["orders", "companies", "profiles", "agreements"];

const EXPECTED_BILLING_RPCS = [
  "lp_billing_post_commission_for_order",
  "lp_billing_post_delivered_commission",
  "lp_billing_post_negative_commission_for_order",
  "lp_billing_create_order_line_snapshot",
  "lp_billing_close_commission_period",
  "lp_billing_create_commission_invoice",
  "lp_billing_create_provider_commission_invoice",
  "lp_billing_invoice_close_dry_run",
  "lp_billing_payment_readiness",
  "lp_billing_provider_readiness",
  "lp_billing_stripe_charge_dry_run",
  "lp_billing_apply_payment_recovery_policy",
  "lp_billing_payment_recovery_status",
];

let failures = 0;
function fail(msg) {
  failures += 1;
  console.error(`FAIL: ${msg}`);
}
function ok(msg) {
  console.log(`OK: ${msg}`);
}
function info(msg) {
  console.log(`   ${msg}`);
}

function localMigrationVersions() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{14}_.+\.sql$/.test(f))
    .map((f) => ({ version: f.slice(0, 14), file: f }))
    .sort((a, b) => a.version.localeCompare(b.version));
}

/** Strip sslmode/ssl URL params so the explicit ssl config below applies (same pattern as tests/_helpers/fixturePg.ts). */
function normalizeDbUrl(raw) {
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");
    return u.toString();
  } catch {
    return raw;
  }
}

const isLocalDb = url.includes("127.0.0.1") || url.includes("localhost");
const client = new pg.Client({
  connectionString: normalizeDbUrl(url),
  connectionTimeoutMillis: 15000,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
});

try {
  await client.connect();
  // Belt-and-braces: force this session read-only. Any accidental write now errors.
  await client.query("SET default_transaction_read_only = on");
  ok("connected (session forced read-only)");

  // 1) Remote applied versions
  const { rows: appliedRows } = await client.query(
    `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version`,
  );
  const applied = new Set(appliedRows.map((r) => String(r.version)));
  const maxApplied = appliedRows.length ? String(appliedRows[appliedRows.length - 1].version) : "(none)";
  ok(`remote applied migrations: ${applied.size} (max ${maxApplied})`);

  // 2) Local files vs remote
  const local = localMigrationVersions();
  const missing = local.filter((m) => !applied.has(m.version));
  const remoteOnly = [...applied].filter((v) => !local.some((m) => m.version === v));

  console.log("\n== Release plan (apply order) ==");
  if (missing.length === 0) {
    ok("no pending migrations — database is up to date");
  } else {
    for (const m of missing) info(m.file);
    ok(`${missing.length} migration(s) pending`);
  }

  if (remoteOnly.length > 0) {
    fail(`remote has versions with no local file (drift): ${remoteOnly.join(", ")} — resolve before push`);
  } else {
    ok("no remote-only versions (no history drift)");
  }

  const outOfOrder = missing.filter((m) => m.version < maxApplied);
  if (outOfOrder.length > 0) {
    ok(`OUT-OF-ORDER apply detected (${outOfOrder.length} version(s) sort before max applied ${maxApplied})`);
    info("=> `supabase db push` will fail closed with LegacyMigrationMissingRemoteError");
    info("=> release command MUST be: supabase db push --include-all");
  } else if (missing.length > 0) {
    ok("pending migrations are strictly after max applied (plain push works; --include-all is still safe)");
  }

  // 3) Pre-state invariants
  console.log("\n== Pre-state invariants ==");
  const { rows: billingRows } = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
    [BILLING_BLOCK_TABLES],
  );
  const billingPresent = billingRows.length;
  if (billingPresent === 0) {
    ok("billing block absent (clean pre-billing base — expected prod state)");
  } else if (billingPresent === BILLING_BLOCK_TABLES.length) {
    ok("billing block fully present (already applied)");
  } else {
    fail(
      `PARTIAL billing block: ${billingPresent}/${BILLING_BLOCK_TABLES.length} tables present — investigate before push (idempotent re-apply may still work, but partial state must be explained)`,
    );
    info(`present: ${billingRows.map((r) => r.tablename).join(", ")}`);
  }

  const { rows: hookRows } = await client.query(
    `SELECT COUNT(*)::int AS n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND p.proname = 'custom_access_token_hook'`,
  );
  if (Number(hookRows[0].n) === 1) ok("custom_access_token_hook present");
  else fail("custom_access_token_hook missing — identity spine phase 2 not applied?");

  const { rows: rlsRows } = await client.query(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1::text[]) AND c.relrowsecurity = false`,
    [CORE_TENANT_TABLES],
  );
  if (rlsRows.length === 0) ok("RLS enabled on core tenant tables (orders/companies/profiles/agreements)");
  else fail(`RLS DISABLED on: ${rlsRows.map((r) => r.relname).join(", ")}`);

  // 4) lp_order_set ownership sanity (protected path)
  const { rows: setRows } = await client.query(
    `SELECT p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'lp_order_set'`,
  );
  if (setRows.length === 1 && setRows[0].prosecdef === true) ok("lp_order_set present (SECURITY DEFINER)");
  else fail("lp_order_set missing or not SECURITY DEFINER");

  // 5) Billing RPC inventory (must match billing table state: all-or-nothing)
  const { rows: rpcRows } = await client.query(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`,
    [EXPECTED_BILLING_RPCS],
  );
  const rpcPresent = new Set(rpcRows.map((r) => r.proname));
  if (billingPresent === 0 && rpcPresent.size === 0) {
    ok(`billing RPCs absent (0/${EXPECTED_BILLING_RPCS.length}) — consistent with pre-billing base`);
  } else if (billingPresent === BILLING_BLOCK_TABLES.length && rpcPresent.size === EXPECTED_BILLING_RPCS.length) {
    ok(`billing RPCs fully present (${rpcPresent.size}/${EXPECTED_BILLING_RPCS.length})`);
  } else {
    fail(
      `billing RPC/table mismatch: ${rpcPresent.size}/${EXPECTED_BILLING_RPCS.length} RPCs vs ${billingPresent}/${BILLING_BLOCK_TABLES.length} tables`,
    );
  }

  // 6) Optional markdown report
  if (reportPath) {
    const now = new Date().toISOString();
    const lines = [];
    lines.push(`# Production migration preflight report`);
    lines.push("");
    lines.push(`Generated: ${now} · Target: (redacted connection) · Mode: READ-ONLY`);
    lines.push(`Remote applied: ${applied.size} · Local files: ${local.length} · Pending: ${missing.length} · Out-of-order: ${outOfOrder.length}`);
    lines.push("");
    lines.push(`Release command: \`supabase db push${outOfOrder.length > 0 ? " --include-all" : ""}\``);
    lines.push("");
    lines.push(`## Migrations (${local.length} local)`);
    lines.push("");
    lines.push("| # | Version | Fil | Status |");
    lines.push("|---|---------|-----|--------|");
    local.forEach((m, i) => {
      const status = applied.has(m.version)
        ? "APPLIED"
        : m.version < maxApplied
          ? "PENDING (out-of-order)"
          : "PENDING";
      lines.push(`| ${i + 1} | ${m.version} | ${m.file} | ${status} |`);
    });
    lines.push("");
    lines.push(`## Billing block — tables (${billingPresent}/${BILLING_BLOCK_TABLES.length} present)`);
    lines.push("");
    lines.push("| Tabell | Status |");
    lines.push("|--------|--------|");
    const billingPresentSet = new Set(billingRows.map((r) => r.tablename));
    for (const t of BILLING_BLOCK_TABLES) {
      lines.push(`| ${t} | ${billingPresentSet.has(t) ? "PRESENT" : "PENDING (applied by push)"} |`);
    }
    lines.push("");
    lines.push(`## Billing block — RPCs (${rpcPresent.size}/${EXPECTED_BILLING_RPCS.length} present)`);
    lines.push("");
    lines.push("| RPC | Status |");
    lines.push("|-----|--------|");
    for (const f of EXPECTED_BILLING_RPCS) {
      lines.push(`| ${f} | ${rpcPresent.has(f) ? "PRESENT" : "PENDING (applied by push)"} |`);
    }
    lines.push("");
    lines.push(`## Pre-state invariants`);
    lines.push("");
    lines.push(`- custom_access_token_hook: ${Number(hookRows[0].n) === 1 ? "PRESENT" : "MISSING"}`);
    lines.push(`- RLS core tenant tables: ${rlsRows.length === 0 ? "ALL ENABLED" : `DISABLED on ${rlsRows.map((r) => r.relname).join(", ")}`}`);
    lines.push(`- lp_order_set SECURITY DEFINER: ${setRows.length === 1 && setRows[0].prosecdef === true ? "OK" : "FAIL"}`);
    lines.push(`- History drift (remote-only versions): ${remoteOnly.length === 0 ? "none" : remoteOnly.join(", ")}`);
    lines.push("");
    lines.push(`Resultat: ${failures === 0 ? "PREFLIGHT PASS" : `PREFLIGHT FAILED (${failures})`}`);
    lines.push("");
    fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
    ok(`report written: ${reportPath}`);
  }
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
} finally {
  await client.end().catch(() => {});
}

if (failures > 0) {
  console.error(`\nPREFLIGHT FAILED — ${failures} finding(s). Do NOT push.`);
  process.exit(1);
}
console.log("\nPREFLIGHT PASS — safe to run: supabase db push --include-all");
