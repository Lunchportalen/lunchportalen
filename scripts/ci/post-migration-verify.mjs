#!/usr/bin/env node
/**
 * GLOBAL RELEASE GATE — post-migration verification (READ-ONLY).
 *
 * Run AFTER `supabase db push --include-all` against the target database:
 *   DATABASE_URL=postgresql://... node scripts/ci/post-migration-verify.mjs
 *
 * Verifies:
 *   1. All local migration files are applied (no pending, no drift)
 *   2. Billing block: 13 tables with RLS ENABLED + >=1 policy each
 *   3. Billing RPCs: 13 functions, SECURITY DEFINER, pinned search_path
 *   4. Grants: anon has ZERO privileges on billing tables
 *   5. Auth hook: custom_access_token_hook + lp_org_is_archived (archived-org guard)
 *   6. Cutoff: lp_company_cutoff_context wired into lp_order_set + tg_orders_cutoff_0800
 *   7. Markets: 21 active rows with complete config (VAT, cutoff, invoice language, stripe status)
 *   8. SECURITY DEFINER hygiene: no public SECDEF function without pinned search_path (report)
 *
 * Never mutates (session forced read-only). Fails closed on any mismatch.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const url = String(process.env.DATABASE_URL ?? "").trim();
if (!url) {
  console.error("FAIL: DATABASE_URL required");
  process.exit(2);
}

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

const BILLING_TABLES = [
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

const BILLING_RPCS = [
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
  await client.query("SET default_transaction_read_only = on");
  ok("connected (session forced read-only)");

  // 1) Migration completeness
  const localFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{14}_.+\.sql$/.test(f))
    .map((f) => f.slice(0, 14))
    .sort();
  const { rows: appliedRows } = await client.query(
    `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version`,
  );
  const applied = new Set(appliedRows.map((r) => String(r.version)));
  const pending = localFiles.filter((v) => !applied.has(v));
  if (pending.length === 0) ok(`all ${localFiles.length} local migrations applied (remote: ${applied.size})`);
  else fail(`pending migrations after push: ${pending.join(", ")}`);

  // 2) Billing tables + RLS + policies
  const { rows: tables } = await client.query(
    `SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1::text[])`,
    [BILLING_TABLES],
  );
  const tByName = new Map(tables.map((r) => [r.relname, r.relrowsecurity]));
  for (const t of BILLING_TABLES) {
    if (!tByName.has(t)) fail(`missing table public.${t}`);
    else if (tByName.get(t) !== true) fail(`RLS not enabled on public.${t}`);
  }
  if (tables.length === BILLING_TABLES.length) ok(`billing tables present: ${tables.length}/13, RLS enabled`);

  const { rows: pol } = await client.query(
    `SELECT tablename, COUNT(*)::int AS n FROM pg_policies
     WHERE schemaname = 'public' AND tablename = ANY($1::text[]) GROUP BY tablename`,
    [BILLING_TABLES],
  );
  const polByName = new Map(pol.map((r) => [r.tablename, r.n]));
  const noPolicy = BILLING_TABLES.filter((t) => (polByName.get(t) ?? 0) === 0);
  if (noPolicy.length === 0) ok("every billing table has >=1 RLS policy");
  else fail(`no policies on: ${noPolicy.join(", ")}`);

  // 3) Billing RPCs (SECDEF + pinned search_path)
  const { rows: fns } = await client.query(
    `SELECT p.proname, p.prosecdef,
            EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) cfg WHERE cfg LIKE 'search_path=%') AS sp
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`,
    [BILLING_RPCS],
  );
  const fnByName = new Map(fns.map((r) => [r.proname, r]));
  for (const f of BILLING_RPCS) {
    const row = fnByName.get(f);
    if (!row) fail(`missing RPC public.${f}`);
    else if (row.prosecdef !== true) fail(`RPC ${f} not SECURITY DEFINER`);
    else if (row.sp !== true) fail(`RPC ${f} missing pinned search_path`);
  }
  if (fns.length === BILLING_RPCS.length) ok(`billing RPCs present: ${fns.length}/13, SECDEF + pinned search_path`);

  // 4) anon grants on billing tables
  const { rows: grants } = await client.query(
    `SELECT table_name, privilege_type FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND table_name = ANY($1::text[]) AND grantee = 'anon'`,
    [BILLING_TABLES],
  );
  if (grants.length === 0) ok("anon has zero grants on billing tables");
  else fail(`anon grants found: ${grants.map((g) => `${g.table_name}:${g.privilege_type}`).join(", ")}`);

  // 5) Auth hook + archived-org guard
  const { rows: hook } = await client.query(
    `SELECT p.proname, pg_get_functiondef(p.oid) AS def
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname IN ('custom_access_token_hook', 'lp_org_is_archived')`,
  );
  const hookDef = hook.find((r) => r.proname === "custom_access_token_hook");
  const guardFn = hook.find((r) => r.proname === "lp_org_is_archived");
  if (!hookDef) fail("custom_access_token_hook missing");
  if (!guardFn) fail("lp_org_is_archived missing (archived-org guard not applied)");
  if (hookDef && guardFn && hookDef.def.includes("lp_org_is_archived")) {
    ok("auth hook present with archived-org guard wired");
  } else if (hookDef && guardFn) {
    fail("auth hook does NOT reference lp_org_is_archived (old hook body?)");
  }

  // 6) Cutoff wiring
  const { rows: cutoff } = await client.query(
    `SELECT p.proname, pg_get_functiondef(p.oid) AS def
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname IN ('lp_order_set', 'tg_orders_cutoff_0800', 'lp_company_cutoff_context')`,
  );
  const cutoffByName = new Map(cutoff.map((r) => [r.proname, r.def]));
  if (!cutoffByName.has("lp_company_cutoff_context")) fail("lp_company_cutoff_context missing");
  for (const fn of ["lp_order_set", "tg_orders_cutoff_0800"]) {
    const def = cutoffByName.get(fn) ?? "";
    if (!def) fail(`${fn} missing`);
    else if (!def.includes("lp_company_cutoff_context")) fail(`${fn} not wired to lp_company_cutoff_context`);
  }
  if (
    cutoffByName.has("lp_company_cutoff_context") &&
    (cutoffByName.get("lp_order_set") ?? "").includes("lp_company_cutoff_context") &&
    (cutoffByName.get("tg_orders_cutoff_0800") ?? "").includes("lp_company_cutoff_context")
  ) {
    ok("market/location timezone cutoff wired (lp_order_set + trigger)");
  }

  // 7) Markets completeness
  const { rows: markets } = await client.query(
    `SELECT country_code, locale, default_currency, default_timezone, vat_rate_food,
            cutoff_local_time, invoice_language, stripe_status, is_active
     FROM public.markets ORDER BY country_code, locale`,
  );
  if (markets.length !== 21) fail(`markets rows: ${markets.length} (expected 21)`);
  const incomplete = markets.filter(
    (m) =>
      !m.default_currency ||
      !m.default_timezone ||
      m.vat_rate_food == null ||
      !m.cutoff_local_time ||
      !m.invoice_language ||
      !m.stripe_status ||
      m.is_active !== true,
  );
  if (markets.length === 21 && incomplete.length === 0) ok("21/21 markets active with complete config");
  else if (incomplete.length > 0) fail(`incomplete market rows: ${incomplete.map((m) => `${m.country_code}/${m.locale}`).join(", ")}`);

  // 8) SECDEF hygiene report (public schema)
  const { rows: unpinned } = await client.query(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef = true
       AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) cfg WHERE cfg LIKE 'search_path=%')
     ORDER BY p.proname`,
  );
  if (unpinned.length === 0) ok("no public SECURITY DEFINER function without pinned search_path");
  else console.log(`   NOTE: ${unpinned.length} SECDEF function(s) without pinned search_path (pre-existing inventory): ${unpinned.slice(0, 10).map((r) => r.proname).join(", ")}${unpinned.length > 10 ? " …" : ""}`);
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
} finally {
  await client.end().catch(() => {});
}

if (failures > 0) {
  console.error(`\nPOST-MIGRATION VERIFY FAILED — ${failures} finding(s).`);
  process.exit(1);
}
console.log("\nPOST-MIGRATION VERIFY PASS");
