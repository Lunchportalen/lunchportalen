#!/usr/bin/env node
/**
 * FASE B3 — production-like billing rollout simulation (LOCAL ONLY).
 *
 * Prod state (documented 2026-07-11): migration history ends at 20260728120000
 * plus cherry-picked 20260810120000; the billing block 20260729..20260809 is MISSING.
 *
 * This script reproduces that state on the LOCAL Supabase database and then applies
 * the billing block the same way a production release would:
 *
 *   1. supabase db reset --version 20260728120000   (pre-billing schema)
 *   2. psql-apply 20260810120000 + record version    (prod cherry-pick parity)
 *   3. supabase migration up                          (billing block + guards, in order)
 *   4. verify: billing tables, RPCs, RLS, grants, SECURITY DEFINER, search_path
 *   5. supabase db reset                              (restore full local state)
 *
 * Fails closed on any missing/unexpected object. Never touches remote databases.
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import pg from "pg";

const LOCAL_DB_URL = process.env.LP_LOCAL_DB_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!LOCAL_DB_URL.includes("127.0.0.1") && !LOCAL_DB_URL.includes("localhost")) {
  console.error("FAIL: refusing non-local database url");
  process.exit(1);
}

const PRE_BILLING_VERSION = "20260728120000";
const CHERRY_PICKED = "20260810120000_msdi_localized_sot_snapshot_trigger_alignment.sql";
const CHERRY_PICKED_VERSION = "20260810120000";

const EXPECTED_TABLES = [
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

const EXPECTED_SECDEF_RPCS = [
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

function runCli(args, label) {
  console.log(`\n== ${label}: npx supabase ${args.join(" ")}`);
  const res = spawnSync("npx", ["supabase", ...args], {
    cwd: process.cwd(),
    shell: true,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (res.stdout) process.stdout.write(res.stdout.slice(-3000));
  if (res.stderr) process.stderr.write(res.stderr.slice(-3000));
  if (res.status !== 0) {
    fail(`${label} exited ${res.status}`);
    return false;
  }
  return true;
}

async function withClient(fn) {
  const client = new pg.Client({ connectionString: LOCAL_DB_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function applyCherryPick() {
  const file = join(process.cwd(), "supabase", "migrations", CHERRY_PICKED);
  const { readFileSync } = await import("node:fs");
  const sql = readFileSync(file, "utf8");
  await withClient(async (c) => {
    await c.query(sql);
    await c.query(
      `INSERT INTO supabase_migrations.schema_migrations (version, name)
       VALUES ($1, $2) ON CONFLICT (version) DO NOTHING`,
      [CHERRY_PICKED_VERSION, CHERRY_PICKED.replace(/\.sql$/, "")],
    );
  });
  ok(`cherry-picked ${CHERRY_PICKED_VERSION} applied + recorded (prod parity)`);
}

async function assertPreBillingState() {
  await withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT COUNT(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
      [EXPECTED_TABLES.filter((t) => !["billing_products", "billing_tax_codes"].includes(t))],
    );
    const preExisting = Number(rows[0].n);
    // markets/commission tables must NOT exist pre-billing.
    if (preExisting !== 0) {
      fail(`pre-billing state has ${preExisting} billing tables (expected 0) — reset --version failed?`);
    } else {
      ok("pre-billing state verified: 0 billing-block tables present");
    }
    const mig = await c.query(`SELECT MAX(version) AS v FROM supabase_migrations.schema_migrations`);
    console.log(`   max applied version: ${mig.rows[0].v}`);
  });
}

async function verifyBillingObjects() {
  await withClient(async (c) => {
    // Tables + RLS
    const { rows: tables } = await c.query(
      `SELECT c.relname, c.relrowsecurity
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1::text[])`,
      [EXPECTED_TABLES],
    );
    const byName = new Map(tables.map((r) => [r.relname, r]));
    for (const t of EXPECTED_TABLES) {
      const row = byName.get(t);
      if (!row) fail(`missing table public.${t}`);
      else if (row.relrowsecurity !== true) fail(`RLS not enabled on public.${t}`);
      else ok(`table ${t} exists with RLS enabled`);
    }

    // RPCs: SECURITY DEFINER + search_path pinned
    const { rows: fns } = await c.query(
      `SELECT p.proname, p.prosecdef,
              EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) cfg WHERE cfg LIKE 'search_path=%') AS sp_pinned
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`,
      [EXPECTED_SECDEF_RPCS],
    );
    const fnByName = new Map(fns.map((r) => [r.proname, r]));
    for (const f of EXPECTED_SECDEF_RPCS) {
      const row = fnByName.get(f);
      if (!row) fail(`missing RPC public.${f}`);
      else if (row.prosecdef !== true) fail(`RPC ${f} is not SECURITY DEFINER`);
      else if (row.sp_pinned !== true) fail(`RPC ${f} has no pinned search_path`);
      else ok(`RPC ${f}: SECURITY DEFINER + pinned search_path`);
    }

    // Policies present on billing tables
    const { rows: pol } = await c.query(
      `SELECT tablename, COUNT(*)::int AS n FROM pg_policies
       WHERE schemaname = 'public' AND tablename = ANY($1::text[])
       GROUP BY tablename`,
      [EXPECTED_TABLES],
    );
    const polByName = new Map(pol.map((r) => [r.tablename, r.n]));
    for (const t of EXPECTED_TABLES) {
      const n = polByName.get(t) ?? 0;
      if (n === 0) fail(`no RLS policies on public.${t}`);
      else ok(`policies on ${t}: ${n}`);
    }

    // Grants: anon must have NO privileges on billing tables
    const { rows: grants } = await c.query(
      `SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
       WHERE table_schema = 'public' AND table_name = ANY($1::text[]) AND grantee = 'anon'`,
      [EXPECTED_TABLES],
    );
    if (grants.length > 0) {
      fail(`anon has grants on billing tables: ${JSON.stringify(grants.slice(0, 5))}`);
    } else {
      ok("anon has zero grants on billing block tables");
    }

    // Duplicate-object sanity: exactly one pg_proc row per expected RPC name
    const { rows: dup } = await c.query(
      `SELECT p.proname, COUNT(*)::int AS n FROM pg_proc p
       JOIN pg_namespace ns ON ns.oid = p.pronamespace
       WHERE ns.nspname = 'public' AND p.proname = ANY($1::text[])
       GROUP BY p.proname HAVING COUNT(*) > 1`,
      [EXPECTED_SECDEF_RPCS],
    );
    if (dup.length) fail(`duplicate RPC definitions: ${JSON.stringify(dup)}`);
    else ok("no duplicate billing RPC definitions");
  });
}

console.log("=== FASE B3: production-like billing rollout simulation (local) ===");

try {
  if (!runCli(["db", "reset", "--version", PRE_BILLING_VERSION], "1) reset to pre-billing")) {
    process.exit(1);
  }
  await assertPreBillingState();
  await applyCherryPick();

  // RUNBOOK EVIDENCE: because prod already has 20260810120000 applied, the billing
  // block versions sort BEFORE the last applied migration. Supabase CLI fails closed
  // with LegacyMigrationMissingRemoteError unless --include-all is passed.
  // Production release MUST therefore use: supabase db push --include-all
  if (!runCli(["migration", "up", "--local", "--include-all"], "3) apply billing block (out-of-order, --include-all)")) {
    fail("billing block could not be applied on production-like base");
  } else {
    console.log("\n== 4) verify billing objects");
    await verifyBillingObjects();
  }
} finally {
  console.log("\n== 5) restore full local state");
  runCli(["db", "reset"], "restore");
}

if (failures > 0) {
  console.error(`\nVERIFY FAILED — ${failures} failure(s)`);
  process.exit(1);
}
console.log("\nVERIFY PASS — billing block applies cleanly on production-like base (with --include-all)");
