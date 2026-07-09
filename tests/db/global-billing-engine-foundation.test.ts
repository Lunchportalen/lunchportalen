import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260729120000_global_billing_engine_foundation.sql",
);
const wiringMigrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260730120000_order_billing_snapshot_ledger_wiring.sql",
);
const readinessMigrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260731120000_billing_readiness_observability.sql",
);
const correctionMigrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260801120000_commission_correction_negative_ledger.sql",
);
const paymentReadinessMigrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260802120000_payment_invoice_readiness_policy.sql",
);
const stripeSetupMigrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260803120000_stripe_setup_intent_onboarding.sql",
);
const invoiceDryRunMigrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260804120000_invoice_close_dry_run.sql",
);
const finalInvoiceMigrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260805120000_final_commission_invoice_creation.sql",
);
const stripeChargeDryRunMigrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260806120000_stripe_charge_dry_run.sql",
);
const stripePaymentWebhookMigrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260808120000_stripe_payment_webhook_accounting.sql",
);
const paymentRecoveryMigrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260809120000_payment_recovery_policy.sql",
);

function migrationSql() {
  return fs.readFileSync(migrationPath, "utf8");
}

function wiringSql() {
  return fs.readFileSync(wiringMigrationPath, "utf8");
}

function readinessSql() {
  return fs.readFileSync(readinessMigrationPath, "utf8");
}

function correctionSql() {
  return fs.readFileSync(correctionMigrationPath, "utf8");
}

function paymentReadinessSql() {
  return fs.readFileSync(paymentReadinessMigrationPath, "utf8");
}

function stripeSetupSql() {
  return fs.readFileSync(stripeSetupMigrationPath, "utf8");
}

function invoiceDryRunSql() {
  return fs.readFileSync(invoiceDryRunMigrationPath, "utf8");
}

function finalInvoiceSql() {
  return fs.readFileSync(finalInvoiceMigrationPath, "utf8");
}

function stripeChargeDryRunSql() {
  return fs.readFileSync(stripeChargeDryRunMigrationPath, "utf8");
}

function stripePaymentWebhookSql() {
  return fs.readFileSync(stripePaymentWebhookMigrationPath, "utf8");
}

function paymentRecoverySql() {
  return fs.readFileSync(paymentRecoveryMigrationPath, "utf8");
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

  it("wires snapshots from inserted order_items without using current menu or provider price rules", () => {
    const sql = wiringSql();

    expect(sql).toContain("CREATE TRIGGER billing_snapshot_order_item_after_insert");
    expect(sql).toContain("AFTER INSERT ON public.order_items");
    expect(sql).toContain("private.lp_billing_create_order_line_snapshot_unchecked(NEW.id)");
    expect(sql).toContain("oi.unit_price_cents_ex_vat");
    expect(sql).toContain("oi.line_subtotal_cents_ex_vat");
    expect(sql).toContain("oi.line_vat_cents");
    expect(sql).toContain("oi.line_total_cents_inc_vat");
    expect(sql).not.toContain("FROM public.provider_price_rules");
    expect(sql).not.toContain("JOIN public.provider_price_rules");
    expect(sql).not.toContain("FROM public.menu_service_day_items");
    expect(sql).not.toContain("JOIN public.menu_service_day_items");
  });

  it("posts delivered commission through one shared idempotent helper for both status paths", () => {
    const sql = wiringSql();

    expect(sql).toContain("private.lp_billing_post_delivered_commission_unchecked");
    expect(sql).toContain("p_event_type <> 'ORDER_COMPLETED'");
    expect(sql).toContain("concat('commission:ORDER_COMPLETED:', v_snapshot.order_id, ':', v_snapshot.order_line_id)");
    expect(sql).toContain("ON CONFLICT (idempotency_key) DO NOTHING");
    expect(sql).toContain("'order delivered via provider status'");
    expect(sql).toContain("'order delivered via batch status'");
  });

  it("does not build payment provider, invoice sending, or UI in the order billing wiring phase", () => {
    const sql = wiringSql().toLowerCase();

    expect(sql).not.toContain("stripe");
    expect(sql).not.toContain("payment_intent");
    expect(sql).not.toContain("send_email");
    expect(sql).not.toContain("invoice_deliveries");
  });

  it("defines a provider-scoped billing readiness RPC without exposing payment secrets", () => {
    const sql = readinessSql();

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.lp_billing_provider_readiness");
    expect(sql).toContain("snapshot_ready boolean");
    expect(sql).toContain("ledger_ready boolean");
    expect(sql).toContain("invoice_ready boolean");
    expect(sql).toContain("missing_requirements text[]");
    expect(sql).toContain("public.can_access_provider(p.id)");
    expect(sql).toContain("public.is_platform_admin()");
    expect(sql).toContain("auth.role() = 'service_role'");
    expect(sql).not.toContain("provider_payment_method_id");
    expect(sql).not.toContain("pm.last4");
    expect(sql).not.toMatch(/\blast4\s+AS\b/i);
    expect(sql).not.toContain("card_number");
    expect(sql).not.toContain("cvv");
  });

  it("tracks precise readiness requirements without Norway/NOK fallback", () => {
    const sql = readinessSql();

    for (const requirement of [
      "organization_missing",
      "billing_profile_missing",
      "market_missing",
      "billing_currency_missing",
      "billing_timezone_missing",
      "legal_country_code_missing",
      "tax_country_code_missing",
      "active_commission_rule_missing",
      "invoice_recipient_missing",
      "payment_customer_missing",
      "payment_method_missing",
    ]) {
      expect(sql).toContain(requirement);
    }

    expect(sql).not.toContain("'NOK'");
    expect(sql).not.toContain("'NO'");
    expect(sql).not.toContain("'Europe/Oslo'");
  });

  it("records idempotent fail-closed snapshot skip diagnostics", () => {
    const sql = readinessSql();

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.billing_readiness_events");
    expect(sql).toContain("'SNAPSHOT_SKIPPED'");
    expect(sql).toContain("billing_readiness_events_idempotency_key_uniq");
    expect(sql).toContain("private.lp_billing_record_readiness_event_unchecked");
    expect(sql).toContain("ON CONFLICT (idempotency_key) DO NOTHING");
    expect(sql).toContain("public.tg_billing_snapshot_order_item");
  });

  it("defines append-only negative commission correction policy from completed ledger only", () => {
    const sql = correctionSql();

    expect(sql).toContain("public.lp_billing_post_negative_commission_for_order");
    expect(sql).toContain("WHERE cl.order_id = p_order_id");
    expect(sql).toContain("AND cl.event_type = 'ORDER_COMPLETED'");
    expect(sql).toContain("-abs(v_completed.commission_basis_amount_minor)");
    expect(sql).toContain("-abs(v_completed.commission_amount_exact)");
    expect(sql).toContain("ON CONFLICT (idempotency_key) DO NOTHING");
    expect(sql).not.toContain("FROM public.provider_price_rules");
    expect(sql).not.toContain("JOIN public.provider_price_rules");
    expect(sql).not.toContain("FROM public.menu_service_day_items");
    expect(sql).not.toContain("JOIN public.menu_service_day_items");
  });

  it("uses explicit negative ledger idempotency keys per event type", () => {
    const sql = correctionSql();

    expect(sql).toContain("commission:ORDER_CANCELLED:");
    expect(sql).toContain("commission:ORDER_REFUNDED:");
    expect(sql).toContain("commission:ORDER_CORRECTED:");
    expect(sql).toContain("commission:CREDIT_NOTE:");
    expect(sql).toContain("NEGATIVE_COMMISSION_REASON_REQUIRED");
    expect(sql).toContain("NEGATIVE_COMMISSION_REFERENCE_REQUIRED");
  });

  it("records diagnostic no-op when correction is attempted without completed ledger", () => {
    const sql = correctionSql();

    expect(sql).toContain("private.lp_billing_record_ledger_skip_unchecked");
    expect(sql).toContain("'LEDGER_SKIPPED'");
    expect(sql).toContain("ARRAY['completed_ledger_missing']::text[]");
    expect(sql).toContain("RETURN 0;");
  });

  it("does not auto-hook cancellation/refund/payment in correction phase", () => {
    const sql = correctionSql().toLowerCase();

    expect(sql).not.toContain("create trigger");
    expect(sql).not.toContain("stripe");
    expect(sql).not.toContain("payment_intent");
    expect(sql).not.toContain("refund.create");
    expect(sql).not.toContain("invoice_deliveries");
  });

  it("defines payment setup, charge, and invoice-period readiness without exposing secrets", () => {
    const sql = paymentReadinessSql();

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.lp_billing_payment_readiness");
    expect(sql).toContain("payment_setup_ready boolean");
    expect(sql).toContain("payment_charge_ready boolean");
    expect(sql).toContain("invoice_period_ready boolean");
    expect(sql).toContain("blocking_readiness_events_count integer");
    expect(sql).toContain("has_raw_card_data boolean");
    expect(sql).toContain("false AS has_raw_card_data");
    expect(sql).not.toContain("provider_payment_method_id,");
    expect(sql).not.toContain("pm.last4");
    expect(sql).not.toMatch(/\blast4\s+AS\b/i);
    expect(sql).not.toContain("card_number");
    expect(sql).not.toContain("cvv");
    expect(sql).not.toContain("raw payment payload text");
  });

  it("hardens payment method metadata statuses and avoids raw card storage", () => {
    const sql = paymentReadinessSql();

    expect(sql).toContain("DROP CONSTRAINT payment_methods_status_chk");
    expect(sql).toContain("status IN ('active', 'verified', 'chargeable', 'replaced', 'expired', 'failed', 'detached')");
    expect(sql).toContain("No PAN, CVV/CVC, raw payment payload");
  });

  it("models blocking readiness events for payment cutover", () => {
    const sql = paymentReadinessSql();

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS is_blocking boolean NOT NULL DEFAULT true");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS resolved_at timestamptz NULL");
    expect(sql).toContain("blocking_readiness_events");
    expect(sql).toContain("blocking_events = 0");
  });

  it("defines invoice and credit-note readiness policy without sending invoices", () => {
    const sql = paymentReadinessSql().toLowerCase();

    expect(sql).toContain("period_mixed_currency");
    expect(sql).toContain("period_already_closed_or_invoiced");
    expect(sql).toContain("credit_note_policy_required");
    expect(sql).toContain("closed/invoiced/paid periods are not rewritten");
    expect(sql).toContain("recipient snapshot is locked at invoice creation");
    expect(sql).not.toContain("send_email");
    expect(sql).not.toContain("stripe_");
    expect(sql).not.toContain("payment_intent");
  });

  it("adds Stripe setup webhook idempotency without raw payload or charge state", () => {
    const sql = stripeSetupSql();

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.stripe_billing_webhook_events");
    expect(sql).toContain("stripe_billing_webhook_events_event_id_uniq");
    expect(sql).toContain("'checkout.session.completed'");
    expect(sql).toContain("'setup_intent.succeeded'");
    expect(sql).toContain("'payment_method.attached'");
    expect(sql).toContain("No raw Stripe payload");
    expect(sql).not.toContain("payload jsonb");
    expect(sql).not.toContain("payment_intent");
    expect(sql).not.toContain("charge_id");
  });

  it("defines read-only invoice close dry-run output contract", () => {
    const sql = invoiceDryRunSql();

    for (const field of [
      "ledger_rows_count integer",
      "positive_basis_amount_minor bigint",
      "negative_basis_amount_minor bigint",
      "net_basis_amount_minor bigint",
      "positive_commission_amount_exact numeric",
      "negative_commission_amount_exact numeric",
      "net_commission_amount_exact numeric",
      "rounded_commission_amount_minor bigint",
      "rounding_adjustment_minor numeric",
      "recipient_emails_snapshot_preview jsonb",
      "has_mixed_currency boolean",
      "has_closed_period_conflict boolean",
      "credit_note_required_count integer",
      "can_close boolean",
      "can_charge boolean",
    ]) {
      expect(sql).toContain(field);
    }
  });

  it("invoice dry-run sums commission ledger only and includes negative events", () => {
    const sql = invoiceDryRunSql();

    expect(sql).toContain("FROM public.commission_ledger cl");
    expect(sql).toContain("CASE WHEN commission_basis_amount_minor > 0");
    expect(sql).toContain("CASE WHEN commission_basis_amount_minor < 0");
    expect(sql).toContain("CASE WHEN commission_amount_exact > 0");
    expect(sql).toContain("CASE WHEN commission_amount_exact < 0");
    expect(sql).not.toContain("provider_price_rules");
    expect(sql).not.toContain("menu_service_day_items");
    expect(sql).not.toContain("order_items oi");
  });

  it("invoice dry-run blocks mixed currency, closed periods, and credit-note candidates", () => {
    const sql = invoiceDryRunSql();

    expect(sql).toContain("period_mixed_currency");
    expect(sql).toContain("period_already_closed_or_invoiced");
    expect(sql).toContain("credit_note_policy_required");
    expect(sql).toContain("cp.status IN ('closed', 'invoiced', 'paid')");
    expect(sql).toContain("count(DISTINCT currency)");
  });

  it("invoice dry-run has no side effects, charge, send, or Stripe behavior", () => {
    const sql = invoiceDryRunSql().toLowerCase();

    expect(sql).toContain("language sql");
    expect(sql).toContain("stable");
    expect(sql).not.toContain("insert into public.commission_periods");
    expect(sql).not.toContain("insert into public.provider_commission_invoices");
    expect(sql).not.toContain("insert into public.invoice_deliveries");
    expect(sql).not.toContain("payment_intent");
    expect(sql).not.toContain("stripe.");
    expect(sql).not.toContain("stripe_");
    expect(sql).not.toContain("send_email");
  });

  it("creates final internal commission invoice from dry-run result only", () => {
    const sql = finalInvoiceSql();

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.lp_billing_create_commission_invoice");
    expect(sql).toContain("FROM public.lp_billing_invoice_close_dry_run");
    expect(sql).toContain("IF NOT coalesce(v_dry.can_close, false)");
    expect(sql).toContain("INSERT INTO public.commission_periods");
    expect(sql).toContain("INSERT INTO public.provider_commission_invoices");
    expect(sql).toContain("'provider_commission_invoice.final_created'");
  });

  it("final invoice creation is idempotent per provider period currency and key", () => {
    const sql = finalInvoiceSql();

    expect(sql).toContain("commission-invoice:");
    expect(sql).toContain("ON CONFLICT (provider_id, period_start, period_end, currency) DO NOTHING");
    expect(sql).toContain("ON CONFLICT (commission_period_id) DO NOTHING");
    expect(sql).toContain("created_new boolean");
  });

  it("final invoice creation snapshots recipients and immutable totals", () => {
    const sql = finalInvoiceSql();

    expect(sql).toContain("sent_to_emails_snapshot");
    expect(sql).toContain("v_dry.recipient_emails_snapshot_preview");
    expect(sql).toContain("v_dry.rounded_commission_amount_minor");
    expect(sql).toContain("v_dry.net_commission_amount_exact");
    expect(sql).toContain("v_dry.currency");
    expect(sql).toContain("'pending'");
  });

  it("final invoice creation does not charge, send, create deliveries, or Stripe objects", () => {
    const sql = finalInvoiceSql().toLowerCase();

    expect(sql).not.toContain("insert into public.invoice_deliveries");
    expect(sql).not.toContain("payment_intent");
    expect(sql).not.toContain("stripe.");
    expect(sql).not.toContain("stripe_");
    expect(sql).not.toContain("send_email");
  });

  it("defines read-only Stripe charge dry-run output contract", () => {
    const sql = stripeChargeDryRunSql();

    for (const field of [
      "provider_invoice_id uuid",
      "amount_minor bigint",
      "payment_provider text",
      "payment_provider_customer_id_present boolean",
      "default_payment_method_present boolean",
      "default_payment_method_status text",
      "payment_charge_ready boolean",
      "invoice_payment_status text",
      "can_create_payment_intent boolean",
      "can_confirm_charge boolean",
      "stripe_preview_metadata jsonb",
    ]) {
      expect(sql).toContain(field);
    }
  });

  it("Stripe charge dry-run blocks unsafe invoice/payment states", () => {
    const sql = stripeChargeDryRunSql();

    for (const requirement of [
      "billing_profile_missing",
      "payment_provider_not_stripe",
      "payment_customer_missing",
      "payment_method_missing",
      "payment_method_not_chargeable",
      "invoice_already_paid",
      "invoice_payment_in_progress",
      "invoice_void",
      "amount_not_positive",
      "currency_mismatch_billing_profile",
      "payment_charge_readiness_failed",
    ]) {
      expect(sql).toContain(requirement);
    }
  });

  it("Stripe charge dry-run metadata is safe and has no side effects", () => {
    const sql = stripeChargeDryRunSql().toLowerCase();

    expect(sql).toContain("lunchportalen_commission_invoice");
    expect(sql).toContain("can_confirm_charge");
    expect(sql).toContain("false");
    expect(sql).not.toContain("paymentmethods.retrieve");
    expect(sql).not.toContain("payment_intents.create");
    expect(sql).not.toContain(".confirm");
    expect(sql).not.toContain(".capture");
    expect(sql).not.toContain("insert into public.invoice_deliveries");
    expect(sql).not.toContain("update public.provider_commission_invoices");
    expect(sql).not.toContain("send_email");
    expect(sql).not.toContain("last4");
    expect(sql).not.toContain("provider_payment_method_id");
  });

  it("extends Stripe webhook idempotency for payment accounting events without raw payload", () => {
    const sql = stripePaymentWebhookSql();

    for (const eventType of [
      "payment_intent.succeeded",
      "payment_intent.payment_failed",
      "payment_intent.processing",
      "payment_intent.requires_action",
      "charge.succeeded",
      "charge.failed",
    ]) {
      expect(sql).toContain(eventType);
    }

    expect(sql).toContain("status IN ('processed', 'ignored', 'unmatched', 'failed')");
    expect(sql).toContain("No raw Stripe payload");
    expect(sql).not.toContain("payload jsonb");
    expect(sql).not.toContain("card_number");
    expect(sql).not.toContain("cvv");
  });

  it("adds retry and grace-period policy fields without executing retries", () => {
    const sql = paymentRecoverySql();

    for (const field of [
      "retry_count integer NOT NULL DEFAULT 0",
      "max_retry_count integer NOT NULL DEFAULT 3",
      "next_retry_at timestamptz NULL",
      "grace_period_until timestamptz NULL",
      "last_payment_error_code text NULL",
      "last_payment_error_message_safe text NULL",
      "payment_blocked_reason text NULL",
    ]) {
      expect(sql).toContain(field);
    }

    expect(sql).not.toContain("paymentIntents.create");
    expect(sql).not.toContain("send_email");
    expect(sql).not.toContain("provider_status = 'SUSPENDED'");
  });

  it("defines read-only recovery status with retry eligibility and suspension signal", () => {
    const sql = paymentRecoverySql();

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.lp_billing_payment_recovery_status");
    expect(sql).toContain("retry_eligible boolean");
    expect(sql).toContain("requires_payment_method_update boolean");
    expect(sql).toContain("can_retry_now boolean");
    expect(sql).toContain("should_notify_provider boolean");
    expect(sql).toContain("should_suspend boolean");
    expect(sql).toContain("safe_failure_code text");
    expect(sql).toContain("safe_failure_message text");
    expect(sql).toContain("LANGUAGE sql");
    expect(sql).toContain("STABLE");
  });

  it("applies payment recovery policy for failed/action_required/processing/paid states", () => {
    const sql = paymentRecoverySql();

    expect(sql).toContain("IF v_status = 'failed'");
    expect(sql).toContain("retry_count = least(retry_count + 1, max_retry_count)");
    expect(sql).toContain("next_retry_at = CASE");
    expect(sql).toContain("grace_period_until = coalesce(grace_period_until, now() + make_interval(days => 14))");
    expect(sql).toContain("ELSIF v_status = 'action_required'");
    expect(sql).toContain("payment_method_action_required");
    expect(sql).toContain("ELSIF v_status = 'processing'");
    expect(sql).toContain("ELSIF v_status = 'paid'");
  });
});
