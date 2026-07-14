/**
 * PHASE 9 — platform commission invoice-only settlement (contract locks).
 *
 * Locks, without hitting a database:
 *  - migration invariants (kind/status model, payments table, sequences, period redirect)
 *  - settlement RPCs are revoked from anon/authenticated (no employee exposure)
 *  - Stripe is out of the launch readiness gate (post-migration-verify)
 *  - server-side settlement policy: invoice_only by default, card charge blocked
 *  - retry-safe cron is scheduled and requires cron auth
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const MIGRATION = "supabase/migrations/20260824120000_commission_invoice_only_settlement.sql";
const HOTFIX = "supabase/migrations/20260824130000_commission_invoice_rpc_variable_conflict_fix.sql";

describe("phase 9 migration invariants", () => {
  const sql = read(MIGRATION);

  it("extends provider_commission_invoices with settlement fields (additive)", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS due_date date");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS payment_terms_days integer NOT NULL DEFAULT 14");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS amount_paid_minor bigint NOT NULL DEFAULT 0");
    expect(sql).toContain("kind IN ('COMMISSION', 'CREDIT')");
  });

  it("widens payment status model with partially_paid/overdue/credited", () => {
    expect(sql).toContain("'partially_paid'");
    expect(sql).toContain("'overdue'");
    expect(sql).toContain("'credited'");
  });

  it("credit invoices are negative mirrors (sign enforced per kind)", () => {
    expect(sql).toContain("kind = 'CREDIT' AND amount_ex_tax_minor <= 0");
  });

  it("manual bank payments are idempotent, integer minor units, positive-only", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.commission_invoice_payments");
    expect(sql).toContain("amount_minor bigint NOT NULL CHECK (amount_minor > 0)");
    expect(sql).toContain("idempotency_key text NOT NULL UNIQUE");
  });

  it("platform invoice numbering is sequential per year (LPK / LPKN)", () => {
    expect(sql).toContain("commission_invoice_sequences");
    expect(sql).toContain("'LPKN'");
    expect(sql).toContain("'LPK'");
  });

  it("closed periods are immutable: late postings redirect to current period", () => {
    expect(sql).toContain("lp_billing_effective_period");
    expect(sql).toContain("cp.status IN ('closed', 'invoiced', 'paid')");
    // Both posting paths use the redirect.
    expect(sql.match(/lp_billing_effective_period\(/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it("settlement RPCs are revoked from anon/authenticated (no employee exposure)", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION %s FROM anon, authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION %s TO service_role, postgres");
  });

  it("contains no functional Stripe usage (invoice-only settlement)", () => {
    // Comments explicitly say "no Stripe"; assert no functional references.
    expect(sql).not.toMatch(/payment_provider_(invoice|payment_intent)_id/);
    expect(sql).not.toMatch(/stripe_[a-z_]+/i);
  });
});

describe("phase 9 idempotent close hotfix", () => {
  const sql = read(HOTFIX);

  it("close is replay-safe: existing invoiced period returns same invoice", () => {
    expect(sql).toContain("#variable_conflict use_column");
    expect(sql).toContain("ON CONFLICT (commission_period_id) WHERE kind = 'COMMISSION' DO NOTHING");
  });
});

describe("stripe removed from launch readiness gate (requirement 23)", () => {
  it("post-migration-verify no longer requires markets.stripe_status", () => {
    const verify = read("scripts/ci/post-migration-verify.mjs");
    expect(verify).not.toContain("!m.stripe_status");
    expect(verify).not.toContain("stripe_status, is_active");
  });
});

describe("server-side settlement policy (requirements 22/24)", () => {
  it("defaults to invoice_only without any env", async () => {
    const prev = process.env.PLATFORM_SETTLEMENT_MODE;
    delete process.env.PLATFORM_SETTLEMENT_MODE;
    const { settlementMode, cardChargesEnabled } = await import("@/lib/billing/settlementPolicy");
    expect(settlementMode()).toBe("invoice_only");
    expect(cardChargesEnabled()).toBe(false);
    if (prev !== undefined) process.env.PLATFORM_SETTLEMENT_MODE = prev;
  });

  it("stripe charge path is explicitly disabled behind the policy", async () => {
    const prev = process.env.PLATFORM_SETTLEMENT_MODE;
    delete process.env.PLATFORM_SETTLEMENT_MODE;
    const { chargeProviderCommissionInvoice } = await import("@/lib/billing/stripeProviderCharge");
    const res = await chargeProviderCommissionInvoice({ providerInvoiceId: "00000000-0000-0000-0000-000000000000" });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.code).toBe("SETTLEMENT_INVOICE_ONLY");
    if (prev !== undefined) process.env.PLATFORM_SETTLEMENT_MODE = prev;
  });
});

describe("retry-safe cron (requirement 20)", () => {
  it("commission settlement cron is scheduled", () => {
    const vercel = JSON.parse(read("vercel.json"));
    const cron = (vercel.crons ?? []).find((c: { path: string }) => c.path === "/api/cron/commission-settlement");
    expect(cron).toBeTruthy();
  });

  it("cron route enforces cron auth and uses idempotent settlement chain", () => {
    const route = read("app/api/cron/commission-settlement/route.ts");
    expect(route).toContain("requireCronAuth(req)");
    expect(route).toContain("closeAndInvoice");
    expect(route).toContain("issueCommissionInvoice");
    expect(route).toContain("deliverCommissionInvoice");
    expect(route).toContain("refreshCommissionOverdue");
    expect(route).not.toMatch(/from ["'].*stripe|Stripe\(/);
  });
});

describe("role surfaces (requirements 17/18)", () => {
  it("superadmin control surface is Norwegian and superadmin-gated", () => {
    const page = read("app/superadmin/provisjon/page.tsx");
    expect(page).toContain("requireSuperadmin()");
    expect(page).toContain("Plattformprovisjon");
    const api = read("app/api/superadmin/commission/route.ts");
    expect(api).toContain("requireSuperadminApi");
  });

  it("provider commission view is read-only and provider-gated", () => {
    const page = read("app/leverandor/provisjon/page.tsx");
    expect(page).toContain("hasProviderRole");
    expect(page).not.toContain('"use client"');
    expect(page).not.toMatch(/fetch\(|action=|onClick/);
  });
});
