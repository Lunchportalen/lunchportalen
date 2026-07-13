/**
 * FASE B — billing block schema integrity (local Supabase only, runtime skip without DB).
 * Companion to scripts/ci/billing-prod-sim-verify.mjs (production-like rollout simulation).
 */
// @ts-nocheck
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";

const LOCAL_DB_URL =
  process.env.LP_LOCAL_DB_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const isLocal = LOCAL_DB_URL.includes("127.0.0.1") || LOCAL_DB_URL.includes("localhost");

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

let client: pg.Client | null = null;
let dbAvailable = false;

beforeAll(async () => {
  if (!isLocal) return;
  const c = new pg.Client({ connectionString: LOCAL_DB_URL, connectionTimeoutMillis: 4000 });
  try {
    await c.connect();
    client = c;
    dbAvailable = true;
  } catch {
    try {
      await c.end();
    } catch {
      /* noop */
    }
  }
});

afterAll(async () => {
  if (client) await client.end();
});

function dbTest(name: string, fn: () => Promise<void>) {
  test(name, async (ctx) => {
    if (!dbAvailable) return ctx.skip();
    await fn();
  });
}

describe("billing block schema integrity (Fase B)", () => {
  dbTest("all billing tables exist with RLS enabled", async () => {
    const { rows } = await client.query(
      `SELECT c.relname, c.relrowsecurity
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1::text[])`,
      [EXPECTED_TABLES],
    );
    const byName = new Map(rows.map((r) => [r.relname, r.relrowsecurity]));
    for (const t of EXPECTED_TABLES) {
      expect(byName.has(t), `missing table ${t}`).toBe(true);
      expect(byName.get(t), `RLS disabled on ${t}`).toBe(true);
    }
  });

  dbTest("every billing table has at least one RLS policy", async () => {
    const { rows } = await client.query(
      `SELECT tablename, COUNT(*)::int AS n FROM pg_policies
       WHERE schemaname = 'public' AND tablename = ANY($1::text[]) GROUP BY tablename`,
      [EXPECTED_TABLES],
    );
    const byName = new Map(rows.map((r) => [r.tablename, r.n]));
    for (const t of EXPECTED_TABLES) {
      expect(byName.get(t) ?? 0, `no policies on ${t}`).toBeGreaterThan(0);
    }
  });

  dbTest("billing RPCs are SECURITY DEFINER with pinned search_path, no duplicates", async () => {
    const { rows } = await client.query(
      `SELECT p.proname, p.prosecdef,
              EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) cfg WHERE cfg LIKE 'search_path=%') AS sp
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`,
      [EXPECTED_SECDEF_RPCS],
    );
    expect(rows.length).toBe(EXPECTED_SECDEF_RPCS.length); // no missing, no duplicates
    for (const r of rows) {
      expect(r.prosecdef, `${r.proname} not SECURITY DEFINER`).toBe(true);
      expect(r.sp, `${r.proname} missing pinned search_path`).toBe(true);
    }
  });

  dbTest("anon role has zero grants on billing tables", async () => {
    const { rows } = await client.query(
      `SELECT table_name, privilege_type FROM information_schema.role_table_grants
       WHERE table_schema = 'public' AND table_name = ANY($1::text[]) AND grantee = 'anon'`,
      [EXPECTED_TABLES],
    );
    expect(rows).toEqual([]);
  });

  dbTest("commission_ledger is append-only (mutation guard trigger present)", async () => {
    const { rows } = await client.query(
      `SELECT t.tgname FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       WHERE c.relname = 'commission_ledger' AND NOT t.tgisinternal`,
    );
    const names = rows.map((r) => r.tgname).join(",");
    expect(names).toMatch(/no_update|no_delete|prevent|mutation|immutab/i);
  });

  dbTest("critical FKs exist on billing accounting chain", async () => {
    const { rows } = await client.query(
      `SELECT conrelid::regclass::text AS tbl, confrelid::regclass::text AS ref
       FROM pg_constraint WHERE contype = 'f'
         AND conrelid::regclass::text = ANY($1::text[])`,
      [["billing_payment_attempts", "provider_commission_invoices", "commission_ledger"]],
    );
    const pairs = rows.map((r) => `${r.tbl}->${r.ref}`);
    expect(pairs.some((p) => p.startsWith("billing_payment_attempts->"))).toBe(true);
    expect(pairs.some((p) => p.startsWith("commission_ledger->"))).toBe(true);
  });
});
