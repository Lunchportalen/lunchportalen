import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260729120000_global_billing_engine_foundation.sql",
);

function migrationSql() {
  return fs.readFileSync(migrationPath, "utf8");
}

describe("global billing engine migration contract", () => {
  it("seeds all 21 requested market/locale setups without mixing BE/CH tax country", () => {
    const sql = migrationSql();

    for (const slug of [
      "us_office_lunch",
      "canadian_office_lunch",
      "dutch_office_lunch",
      "belgian_dutch_office_lunch",
      "belgian_french_office_lunch",
      "austrian_office_lunch",
      "swiss_german_office_lunch",
      "swiss_french_office_lunch",
      "irish_office_lunch",
      "luxembourg_office_lunch",
      "australian_office_lunch",
      "singapore_office_lunch",
      "norwegian_office_lunch",
      "swedish_office_lunch",
      "danish_office_lunch",
      "finnish_office_lunch",
      "uk_office_lunch",
      "german_office_lunch",
      "french_office_lunch",
      "spanish_office_lunch",
      "italian_office_lunch",
    ]) {
      expect(sql).toContain(slug);
    }

    expect(sql).toContain("('BE', 'nl-BE', 'belgian_dutch_office_lunch', 'EUR', 'Europe/Brussels', 'BE'");
    expect(sql).toContain("('BE', 'fr-BE', 'belgian_french_office_lunch', 'EUR', 'Europe/Brussels', 'BE'");
    expect(sql).toContain("('CH', 'de-CH', 'swiss_german_office_lunch', 'CHF', 'Europe/Zurich', 'CH'");
    expect(sql).toContain("('CH', 'fr-CH', 'swiss_french_office_lunch', 'CHF', 'Europe/Zurich', 'CH'");
  });

  it("keeps commission ledger and billing audit append-only", () => {
    const sql = migrationSql();

    expect(sql).toContain("commission_ledger is append-only");
    expect(sql).toContain("billing_audit_log is append-only");
    expect(sql).toContain("order_line_commercial_snapshots is append-only");
    expect(sql).toContain("commission_ledger_no_update");
    expect(sql).toContain("commission_ledger_no_delete");
    expect(sql).toContain("billing_audit_log_no_update");
    expect(sql).toContain("billing_audit_log_no_delete");
    expect(sql).toContain("order_line_snapshots_no_update");
    expect(sql).toContain("order_line_snapshots_no_delete");
  });

  it("stores only payment method metadata, not raw card data fields", () => {
    const sql = migrationSql().toLowerCase();

    expect(sql).toContain("last4");
    expect(sql).toContain("provider_payment_method_id");
    expect(sql).not.toMatch(/\b(card_number|cvv|raw_card)\b\s+(text|varchar|character varying|jsonb)/);
  });

  it("does not wire order snapshots into the protected order write path automatically", () => {
    const sql = migrationSql();

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.order_line_commercial_snapshots");
    expect(sql).not.toContain("CREATE TRIGGER order_line_commercial_snapshots");
    expect(sql).not.toContain("CREATE TRIGGER orders_");
    expect(sql).not.toContain("CREATE TRIGGER order_items_");
  });

  it("requires billing email changes through the audited RPC path", () => {
    const sql = migrationSql();

    expect(sql).toContain("lp_provider_update_billing_email");
    expect(sql).toContain("'billing_email.changed'");
    expect(sql).not.toContain("GRANT UPDATE (billing_email_current)");
    expect(sql).not.toContain("organization_billing_profiles_provider_admin_update");
  });

  it("locks invoice recipient snapshots and forbids empty sent_to snapshots", () => {
    const sql = migrationSql();

    expect(sql).toContain("provider_commission_invoices_recipient_snapshot_nonempty_chk");
    expect(sql).toContain("jsonb_array_length(sent_to_emails_snapshot) > 0");
    expect(sql).toContain("provider_commission_invoices_guard_immutable_update");
    expect(sql).toContain("OLD.sent_to_emails_snapshot IS DISTINCT FROM NEW.sent_to_emails_snapshot");
  });

  it("supports explicit queued delivery state", () => {
    const sql = migrationSql();

    expect(sql).toContain("delivery_status text NOT NULL DEFAULT 'queued'");
    expect(sql).toContain("delivery_status IN ('queued', 'pending', 'sent', 'delivered', 'failed', 'bounced', 'skipped')");
  });

  it("closes periods from ledger billing_period rather than ledger creation timestamp", () => {
    const sql = migrationSql();

    expect(sql).toContain("cl.billing_period = to_char(p_period_start, 'YYYY-MM')");
    expect(sql).not.toContain("cl.created_at >= p_period_start::timestamptz");
  });

  it("fails closed for commercial snapshots when billing profile or market is missing", () => {
    const sql = migrationSql();

    expect(sql).toContain("JOIN public.organization_billing_profiles obp ON obp.organization_id = o.provider_id");
    expect(sql).toContain("JOIN public.markets m ON m.id = coalesce(p_market_id, obp.market_id)");
    expect(sql).not.toContain("coalesce(m.locale, ps.locale, 'nb-NO')");
    expect(sql).not.toContain("coalesce(nullif(o.currency_code, ''), obp.billing_currency, ps.default_currency, 'NOK')");
  });
});
