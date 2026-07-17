// lib/billing/commissionSettlement.ts
//
// FASE 9 — invoice-only oppgjør av Lunchportalens 5 %-provisjon.
// Kanonisk regel: 5 % (LP_GLOBAL_5P, 500 bps) av providerens NETTO lunsjsalg
// ekskl. MVA — alltid integer minor units, valuta bevart per provider.
// INGEN Stripe: levering via e-post (outbox) og manuell bankbetaling.
import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";
import {
  assertPlatformInvoiceWithoutMvaAllowed,
  assertPlatformMvaInvoiceAllowed,
} from "@/lib/markets/norwayFirstActivation";
import {
  assertNorwayCommissionInvoiceTransmittable,
  NORWAY_PRE_REGISTRATION_INVOICE_NOTE_NB,
} from "@/lib/markets/norwayMvaController";

function admin() {
  return supabaseAdmin() as any;
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export type CommissionDryRun = {
  provider_id: string;
  period_start: string;
  period_end: string;
  currency: string;
  ledger_rows_count: number;
  net_basis_amount_minor: number;
  rounded_commission_amount_minor: number;
  can_close: boolean;
  missing_requirements: string[];
};

export type CommissionInvoiceRow = {
  id: string;
  provider_id: string;
  commission_period_id: string;
  invoice_number: string | null;
  kind: string;
  payment_status: string;
  currency: string;
  amount_ex_tax_minor: number;
  total_amount_minor: number;
  amount_paid_minor: number;
  due_date: string | null;
  issued_at: string | null;
  paid_at: string | null;
  billing_email_snapshot: string | null;
  credit_of_invoice_id: string | null;
  created_at: string;
};

const INVOICE_FIELDS =
  "id, provider_id, commission_period_id, invoice_number, kind, payment_status, currency, amount_ex_tax_minor, total_amount_minor, amount_paid_minor, due_date, issued_at, paid_at, billing_email_snapshot, credit_of_invoice_id, created_at";

/** Distinkte valutaer i ledgeren for en provider+periode (multi-currency). */
export async function listLedgerCurrencies(providerId: string, period: string): Promise<string[]> {
  const { data } = await admin()
    .from("commission_ledger")
    .select("currency")
    .eq("provider_id", providerId)
    .eq("billing_period", period);
  return [...new Set(((data ?? []) as Array<{ currency: string }>).map((r) => safeStr(r.currency)).filter(Boolean))];
}

export async function commissionDryRun(p: {
  providerId: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
}): Promise<{ ok: true; data: CommissionDryRun } | { ok: false; code: string }> {
  const { data, error } = await admin().rpc("lp_billing_invoice_close_dry_run", {
    p_provider_id: p.providerId,
    p_period_start: p.periodStart,
    p_period_end: p.periodEnd,
    p_currency: p.currency,
  });
  if (error) return { ok: false, code: safeStr(error.message) || "DRY_RUN_FAILED" };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, code: "DRY_RUN_EMPTY" };
  return { ok: true, data: row as CommissionDryRun };
}

/** Eksplisitt close + intern faktura (idempotent RPC-kjede). */
export async function closeAndInvoice(p: {
  providerId: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
}): Promise<{ ok: true; invoiceId: string; createdNew: boolean } | { ok: false; code: string }> {
  const { data, error } = await admin().rpc("lp_billing_create_commission_invoice", {
    p_provider_id: p.providerId,
    p_period_start: p.periodStart,
    p_period_end: p.periodEnd,
    p_currency: p.currency,
    p_idempotency_key: null,
  });
  if (error) return { ok: false, code: safeStr(error.message) || "CLOSE_FAILED" };
  const row = Array.isArray(data) ? data[0] : data;
  const invoiceId = safeStr(row?.provider_invoice_id);
  if (!invoiceId) return { ok: false, code: "INVOICE_ID_MISSING" };
  return { ok: true, invoiceId, createdNew: Boolean(row?.created_new) };
}

export async function issueCommissionInvoice(invoiceId: string, actor: string | null) {
  // Phase 16NO.4: allow without-MVA pre-registration; block MVA until registered;
  // hold transmission when crossing event is pending.
  try {
    const { data: inv } = await admin()
      .from("provider_commission_invoices")
      .select("id, tax_amount_minor")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!inv) return { ok: false as const, code: "COMMISSION_INVOICE_NOT_FOUND" };
    const tax = Number(inv.tax_amount_minor ?? 0);
    if (tax > 0) {
      assertPlatformMvaInvoiceAllowed();
    } else {
      assertPlatformInvoiceWithoutMvaAllowed();
    }
    await assertNorwayCommissionInvoiceTransmittable(invoiceId);
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: string }).code)
        : "PLATFORM_INVOICE_BLOCKED";
    return { ok: false as const, code };
  }
  const { data, error } = await admin().rpc("lp_commission_invoice_issue", {
    p_invoice_id: invoiceId,
    p_actor_user_id: actor,
  });
  if (error) return { ok: false as const, code: safeStr(error.message) || "ISSUE_FAILED" };
  return { ok: true as const, data };
}

/**
 * Levering til provider billing email (snapshot-mottakere) via idempotent
 * outbox. Feilede leveranser registreres i invoice_deliveries +
 * billing_readiness_events (observability, krav 21). Fail-closed uten mottaker.
 */
export async function deliverCommissionInvoice(
  invoiceId: string,
  opts?: { force?: boolean },
): Promise<{ ok: true; recipients: string[] } | { ok: false; code: string }> {
  const a = admin();
  const { data: inv } = await a
    .from("provider_commission_invoices")
    .select(INVOICE_FIELDS + ", sent_to_emails_snapshot, tax_amount_minor")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return { ok: false, code: "COMMISSION_INVOICE_NOT_FOUND" };
  if (!inv.invoice_number) return { ok: false, code: "COMMISSION_INVOICE_NOT_ISSUED" };

  try {
    const tax = Number(inv.tax_amount_minor ?? 0);
    if (tax > 0) {
      assertPlatformMvaInvoiceAllowed();
    } else {
      assertPlatformInvoiceWithoutMvaAllowed();
    }
    await assertNorwayCommissionInvoiceTransmittable(invoiceId);
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: string }).code)
        : "PLATFORM_INVOICE_BLOCKED";
    return { ok: false, code };
  }

  const recipients = (Array.isArray(inv.sent_to_emails_snapshot) ? inv.sent_to_emails_snapshot : [])
    .map((e: unknown) => safeStr(e).toLowerCase())
    .filter(Boolean);
  if (recipients.length === 0) return { ok: false, code: "COMMISSION_INVOICE_NO_RECIPIENTS" };

  const nf = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const amount = nf.format(Number(inv.total_amount_minor) / 100);
  const taxMinor = Number(inv.tax_amount_minor ?? 0);
  const kindLabel = inv.kind === "CREDIT" ? "Kreditfaktura" : "Provisjonsfaktura";
  const mvaNote =
    taxMinor === 0
      ? `\n\n${NORWAY_PRE_REGISTRATION_INVOICE_NOTE_NB}\n`
      : `\n\nMerverdiavgift (25 %) er beregnet på plattformprovisjonen.\n`;
  const eventKey = `commission.invoice.email:${invoiceId}`;

  // Idempotent levering: allerede enqueued (f.eks. daglig cron-replay) → aldri
  // re-enqueue/reset av outbox-status. Re-send krever eksplisitt force (resend).
  if (!opts?.force) {
    const { data: existing } = await a.from("outbox").select("id").eq("event_key", eventKey).maybeSingle();
    if (existing?.id) return { ok: true, recipients };
  }

  try {
    const { error: outboxErr } = await a.from("outbox").upsert(
      {
        event_key: eventKey,
        payload: {
          event: "commission.invoice.email",
          type: "commission.invoice.email",
          from: "Lunchportalen <no-reply@lunchportalen.no>",
          to: recipients.join(", "),
          subject: `${kindLabel} ${inv.invoice_number} – Lunchportalen (5 % plattformprovisjon)`,
          bodyText: `Hei,\n\n${kindLabel} ${inv.invoice_number} fra Lunchportalen.\n\nBeløp: ${amount} ${inv.currency} (5 % av netto lunsjsalg ekskl. kundens MVA)\n${inv.due_date ? `Forfallsdato: ${inv.due_date}\n` : ""}${mvaNote}\nBetaling skjer via bankoverføring (ingen kortbetaling). Detaljert grunnlag er tilgjengelig i leverandørflaten under «Provisjon».\n\nMed vennlig hilsen\nLunchportalen`,
          invoice_id: invoiceId,
          invoice_number: inv.invoice_number,
          tax_treatment:
            taxMinor === 0
              ? "NO_PLATFORM_SERVICE_NOT_REGISTERED_NO_VAT"
              : "NO_PLATFORM_SERVICE_STANDARD_VAT_25",
        },
        status: "PENDING",
        attempts: 0,
      },
      { onConflict: "event_key" },
    );
    if (outboxErr) throw new Error(outboxErr.message);

    for (const email of recipients) {
      await a.from("invoice_deliveries").upsert(
        {
          invoice_id: invoiceId,
          recipient_email: email,
          recipient_type: email === safeStr(inv.billing_email_snapshot).toLowerCase() ? "billing_email" : "admin",
          delivery_status: "sent",
          sent_at: new Date().toISOString(),
        },
        { onConflict: "invoice_id,recipient_email,recipient_type" },
      );
    }
    return { ok: true, recipients };
  } catch (e) {
    const detail = safeStr((e as Error)?.message);
    opsLog("commission.delivery.failed", { invoiceId, detail });
    // Observability (krav 21): feilet leveranse er en sporbar hendelse.
    await a
      .from("invoice_deliveries")
      .upsert(
        {
          invoice_id: invoiceId,
          recipient_email: recipients[0],
          recipient_type: "billing_email",
          delivery_status: "failed",
          failed_at: new Date().toISOString(),
          failed_reason: detail.slice(0, 500),
        },
        { onConflict: "invoice_id,recipient_email,recipient_type" },
      )
      .then(() => null)
      .catch(() => null);
    await a
      .from("billing_readiness_events")
      .insert({
        provider_id: inv.provider_id,
        order_id: null,
        order_line_id: null,
        event_type: "READINESS_CHECK",
        missing_requirements: ["invoice_delivery_failed"],
        detail: { invoice_id: invoiceId, reason: detail.slice(0, 500) },
        idempotency_key: `billing-readiness:DELIVERY_FAILED:${invoiceId}:${Date.now()}`,
      })
      .then(() => null)
      .catch(() => null);
    return { ok: false, code: "DELIVERY_FAILED" };
  }
}

export async function registerCommissionPayment(p: {
  invoiceId: string;
  amountMinor: number;
  paidAt: string | null;
  method: string | null;
  reference: string | null;
  idempotencyKey: string;
  actor: string | null;
}) {
  const { data, error } = await admin().rpc("lp_commission_invoice_register_payment", {
    p_invoice_id: p.invoiceId,
    p_amount_minor: Math.trunc(p.amountMinor),
    p_paid_at: p.paidAt,
    p_method: p.method,
    p_reference: p.reference,
    p_idempotency_key: p.idempotencyKey,
    p_actor_user_id: p.actor,
  });
  if (error) return { ok: false as const, code: safeStr(error.message) || "PAYMENT_FAILED" };
  return { ok: true as const, data };
}

export async function refreshCommissionOverdue() {
  const { data, error } = await admin().rpc("lp_commission_invoice_refresh_overdue", {});
  if (error) return { ok: false as const, code: safeStr(error.message) };
  return { ok: true as const, data };
}

export async function createCommissionCredit(p: { invoiceId: string; reason: string; actor: string | null }) {
  const { data, error } = await admin().rpc("lp_commission_invoice_create_credit", {
    p_invoice_id: p.invoiceId,
    p_reason: p.reason,
    p_actor_user_id: p.actor,
  });
  if (error) return { ok: false as const, code: safeStr(error.message) || "CREDIT_FAILED" };
  return { ok: true as const, data };
}

export async function listCommissionInvoices(providerId?: string | null): Promise<CommissionInvoiceRow[]> {
  let q = admin().from("provider_commission_invoices").select(INVOICE_FIELDS).order("created_at", { ascending: false }).limit(200);
  if (providerId) q = q.eq("provider_id", providerId);
  const { data, error } = await q;
  if (error) throw new Error(`listCommissionInvoices failed: ${error.message}`);
  return (data ?? []) as CommissionInvoiceRow[];
}

/** Provider read-only månedsoppsummering fra ledgeren (per valuta). */
export async function providerCommissionSummary(providerId: string): Promise<
  Array<{ period: string; currency: string; basisMinor: number; commissionMinor: number; rows: number }>
> {
  const { data, error } = await admin()
    .from("commission_ledger")
    .select("billing_period, currency, commission_basis_amount_minor, commission_amount_exact")
    .eq("provider_id", providerId)
    .order("billing_period", { ascending: false })
    .limit(2000);
  if (error) throw new Error(`providerCommissionSummary failed: ${error.message}`);

  const byKey = new Map<string, { period: string; currency: string; basisMinor: number; commissionExact: number; rows: number }>();
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    const key = `${r.billing_period}|${r.currency}`;
    const cur = byKey.get(key) ?? {
      period: safeStr(r.billing_period),
      currency: safeStr(r.currency),
      basisMinor: 0,
      commissionExact: 0,
      rows: 0,
    };
    cur.basisMinor += Number(r.commission_basis_amount_minor ?? 0);
    cur.commissionExact += Number(r.commission_amount_exact ?? 0);
    cur.rows += 1;
    byKey.set(key, cur);
  }
  return [...byKey.values()]
    .map((v) => ({
      period: v.period,
      currency: v.currency,
      basisMinor: v.basisMinor,
      commissionMinor: Math.round(v.commissionExact),
      rows: v.rows,
    }))
    .sort((a, b) => b.period.localeCompare(a.period) || a.currency.localeCompare(b.currency));
}

/** Forrige kalendermåned (UTC) som [start, endExclusive-1] ISO-datoer. */
export function previousMonthRange(now = new Date()): { start: string; end: string; period: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based current month
  const start = new Date(Date.UTC(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end), period: iso(start).slice(0, 7) };
}
