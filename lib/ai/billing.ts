import "server-only";

/**
 * AI ↔ SaaS billing bridge: estimated provider cost vs plan allowance, company flag, Stripe invoice line items.
 *
 * Env (optional):
 * - SAAS_LIST_MRR_BASIC_USD / PRO / ENTERPRISE — list MRR for margin_vs_cost (USD, not sent to Stripe).
 * - AI_BILLING_OVERAGE_ENABLED=true — add draft invoice line for usage above included budget.
 * - AI_BILLING_OVERAGE_MARKUP=1.25 — multiplier on overage USD before currency conversion.
 * - AI_BILLING_USD_TO_NOK=11 — when invoice currency is nok (override with AI_BILLING_USD_TO_<CUR>).
 */

import type Stripe from "stripe";
import { getCompanySaasPlanForAi } from "@/lib/ai/entitlements";
import { isOnlinePaymentAllowed } from "@/lib/billing/paymentPolicy";
import { opsLog } from "@/lib/ops/log";
import {
  aggregateCompanyAiRunnerUsage,
  getAiUsageLimitsForPlan,
  type AiUsageAggregate,
  type AiUsagePeriodBounds,
} from "@/lib/ai/usage";
import { supabaseAdmin } from "@/lib/supabase/admin";

function trimEnv(k: string): string {
  return String(process.env[k] ?? "").trim();
}

function envNumber(k: string, fallback: number): number {
  const n = Number(trimEnv(k));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function envBool(k: string): boolean {
  return trimEnv(k).toLowerCase() === "true" || trimEnv(k) === "1";
}

/**
 * List/catalog MRR used for margin math only (USD). Not sent to Stripe; configure to match your price sheet.
 */
export function getPlanListMrrUsd(plan: string): number | null {
  const map: Record<string, string> = {
    basic: "SAAS_LIST_MRR_BASIC_USD",
    pro: "SAAS_LIST_MRR_PRO_USD",
    enterprise: "SAAS_LIST_MRR_ENTERPRISE_USD",
  };
  const key = map[plan];
  if (!key) return null;
  const raw = trimEnv(key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export type CompanyAiBillingSnapshot = {
  company_id: string;
  plan: string;
  period: AiUsagePeriodBounds;
  usage: AiUsageAggregate;
  /** Included AI spend in plan (USD); null = unlimited / not applicable */
  included_ai_budget_usd: number | null;
  /** Estimated provider cost (USD) */
  estimated_cost_usd: number;
  /** max(0, cost - included) when included set */
  overage_cost_usd: number;
  /** List MRR from env (USD); null if unset */
  list_mrr_usd: number | null;
  /** list_mrr_usd - estimated_cost_usd when MRR known */
  margin_vs_cost_usd: number | null;
  /** cost > included budget (when budget capped) */
  flagged_over_included: boolean;
};

function boundsFromUnixRange(periodStart: number, periodEnd: number): AiUsagePeriodBounds {
  const start = new Date(periodStart * 1000).toISOString();
  const end = new Date(periodEnd * 1000).toISOString();
  const d0 = new Date(periodStart * 1000);
  const label = `${d0.getUTCFullYear()}-${String(d0.getUTCMonth() + 1).padStart(2, "0")}`;
  return { periodStartIso: start, periodEndIso: end, periodLabel: label };
}

/**
 * Cost, included allowance, overage, margin (vs list MRR), and threshold flag for one company + time range.
 */
export async function computeCompanyAiBillingSnapshot(
  companyId: string,
  period: AiUsagePeriodBounds,
): Promise<CompanyAiBillingSnapshot> {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) throw new Error("MISSING_COMPANY_ID");

  const plan = await getCompanySaasPlanForAi(companyId);
  const limits = getAiUsageLimitsForPlan(plan);
  const usage = await aggregateCompanyAiRunnerUsage(companyId, period);
  const included = limits.maxCostUsdPerMonth;
  const cost = usage.cost_estimate_usd;
  const overage = included != null && included > 0 ? Math.max(0, cost - included) : 0;
  const listMrr = getPlanListMrrUsd(plan);
  const margin = listMrr != null ? listMrr - cost : null;
  const flagged = included != null && included > 0 && cost > included;

  return {
    company_id: id,
    plan,
    period,
    usage,
    included_ai_budget_usd: included,
    estimated_cost_usd: cost,
    overage_cost_usd: overage,
    list_mrr_usd: listMrr,
    margin_vs_cost_usd: margin,
    flagged_over_included: flagged,
  };
}

/**
 * Persist flag + last evaluated amounts on companies (service role).
 */
export async function persistCompanyAiBillingEvaluation(snapshot: CompanyAiBillingSnapshot): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("companies")
    .update({
      ai_billing_flagged: snapshot.flagged_over_included,
      ai_billing_flag_reason: snapshot.flagged_over_included ? "COST_OVER_INCLUDED_BUDGET" : null,
      ai_billing_evaluated_at: new Date().toISOString(),
      ai_billing_last_period_cost_usd: snapshot.estimated_cost_usd,
      ai_billing_last_period_overage_usd: snapshot.overage_cost_usd,
    })
    .eq("id", snapshot.company_id);

  if (error) {
    throw new Error(`AI_BILLING_PERSIST_FAILED: ${error.message}`);
  }
}

function minorUnitsFromMajor(amountMajor: number, currency: string): number {
  const cur = currency.toLowerCase();
  const safe = Number.isFinite(amountMajor) && amountMajor > 0 ? amountMajor : 0;
  if (cur === "jpy" || cur === "vnd" || cur === "krw") {
    return Math.round(safe);
  }
  return Math.round(safe * 100);
}

function convertUsdToInvoiceCurrency(usd: number, invoiceCurrency: string): number {
  const cur = invoiceCurrency.toLowerCase();
  if (cur === "usd") return usd;
  if (cur === "nok") {
    const rate = envNumber("AI_BILLING_USD_TO_NOK", 11);
    return usd * rate;
  }
  const rate = envNumber(`AI_BILLING_USD_TO_${cur.toUpperCase()}`, 1);
  return usd * rate;
}

const AI_USAGE_LINE_METADATA_KEY = "lunchportalen_ai_usage";
const AI_USAGE_LINE_METADATA_VAL = "1";

async function invoiceAlreadyHasAiUsageLine(stripe: Stripe, invoiceId: string): Promise<boolean> {
  const lines = await stripe.invoiceItems.list({ invoice: invoiceId, limit: 100 });
  for (const line of lines.data) {
    const m = line.metadata?.[AI_USAGE_LINE_METADATA_KEY];
    if (m === AI_USAGE_LINE_METADATA_VAL) return true;
  }
  return false;
}

export type AttachAiUsageToInvoiceResult =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; skipped: false; snapshot: CompanyAiBillingSnapshot; invoice_item_id?: string }
  | { ok: false; message: string };

/**
 * On Stripe draft (or open) subscription invoice: attach optional overage line item + refresh company billing flag.
 * Fail-soft for Stripe errors after flag persist — webhook should still return 200 when possible.
 */
export async function attachAiUsageToStripeInvoice(params: {
  stripe: Stripe;
  invoice: Stripe.Invoice;
}): Promise<AttachAiUsageToInvoiceResult> {
  const { stripe, invoice } = params;

  if (!isOnlinePaymentAllowed()) {
    opsLog("unauthorized_payment_attempt", {
      surface: "attachAiUsageToStripeInvoice",
      invoiceId: invoice.id,
    });
    return { ok: true, skipped: true, reason: "ONLINE_PAYMENT_DISABLED_BY_POLICY" };
  }

  const customerRaw = invoice.customer;
  const customerId = typeof customerRaw === "string" ? customerRaw : customerRaw?.id;
  if (!customerId) {
    return { ok: true, skipped: true, reason: "NO_CUSTOMER" };
  }

  if (invoice.status !== "draft" && invoice.status !== "open") {
    return { ok: true, skipped: true, reason: `INVOICE_STATUS_${invoice.status ?? "unknown"}` };
  }

  const periodStart = invoice.period_start;
  const periodEnd = invoice.period_end;
  if (!periodStart || !periodEnd) {
    return { ok: true, skipped: true, reason: "NO_INVOICE_PERIOD" };
  }

  const { data: subRow, error: subErr } = await supabaseAdmin()
    .from("saas_subscriptions")
    .select("company_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (subErr) {
    return { ok: false, message: subErr.message };
  }
  const companyId = typeof subRow?.company_id === "string" ? subRow.company_id.trim() : "";
  if (!companyId) {
    return { ok: true, skipped: true, reason: "NO_COMPANY_FOR_CUSTOMER" };
  }

  const period = boundsFromUnixRange(periodStart, periodEnd);
  let snapshot: CompanyAiBillingSnapshot;
  try {
    snapshot = await computeCompanyAiBillingSnapshot(companyId, period);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }

  try {
    await persistCompanyAiBillingEvaluation(snapshot);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }

  const overageEnabled = envBool("AI_BILLING_OVERAGE_ENABLED");
  const markup = envNumber("AI_BILLING_OVERAGE_MARKUP", 1);
  const currency = (invoice.currency || "usd").toLowerCase();

  let invoiceItemId: string | undefined;
  if (overageEnabled && snapshot.included_ai_budget_usd != null && snapshot.overage_cost_usd > 0) {
    const billableUsd = snapshot.overage_cost_usd * markup;
    const major = convertUsdToInvoiceCurrency(billableUsd, currency);
    const amountMinor = minorUnitsFromMajor(major, currency);
    if (amountMinor > 0) {
      const hasLine = await invoiceAlreadyHasAiUsageLine(stripe, invoice.id);
      if (!hasLine) {
        const created = await stripe.invoiceItems.create({
          customer: customerId,
          invoice: invoice.id,
          currency,
          amount: amountMinor,
          description: `Lunchportalen AI — bruk utover inkludert kvote (${period.periodLabel}, estimat)`,
          metadata: {
            [AI_USAGE_LINE_METADATA_KEY]: AI_USAGE_LINE_METADATA_VAL,
            company_id: companyId,
            period_start: String(periodStart),
            period_end: String(periodEnd),
            overage_usd_estimate: String(Number(snapshot.overage_cost_usd.toFixed(6))),
            cost_usd_estimate: String(Number(snapshot.estimated_cost_usd.toFixed(6))),
          },
        });
        invoiceItemId = created.id;
      }
    }
  }

  return { ok: true, skipped: false, snapshot, invoice_item_id: invoiceItemId };
}
