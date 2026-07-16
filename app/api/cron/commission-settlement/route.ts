// app/api/cron/commission-settlement/route.ts
//
// FASE 9 — retry-safe månedlig provisjonsoppgjør (invoice-only, INGEN Stripe).
// Idempotent kjede per provider × valuta for FORRIGE måned:
//   dry-run → close+intern faktura → utsted (nummer + forfall) → levering (e-post).
// I tillegg: forfalls-oppdatering (overdue). Alle steg er idempotente RPC-er,
// så retriggering er trygt. Feil per provider stopper aldri resten.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { requireCronAuth } from "@/lib/http/cronAuth";
import { captureCronHandlerError } from "@/lib/http/cronObservability";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import {
  closeAndInvoice,
  commissionDryRun,
  deliverCommissionInvoice,
  issueCommissionInvoice,
  listLedgerCurrencies,
  previousMonthRange,
  refreshCommissionOverdue,
} from "@/lib/billing/commissionSettlement";

export async function POST(req: Request) {
  const rid = makeRid();
  try {
    requireCronAuth(req);

    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = supabaseAdmin() as any;

    const overdue = await refreshCommissionOverdue();
    const { start, end, period } = previousMonthRange();

    const { data: ledgerProviders } = await admin
      .from("commission_ledger")
      .select("provider_id")
      .eq("billing_period", period)
      .limit(5000);
    const providerIds = [
      ...new Set(((ledgerProviders ?? []) as Array<{ provider_id: string }>).map((r) => String(r.provider_id))),
    ];

    const results: Array<Record<string, unknown>> = [];
    for (const providerId of providerIds) {
      const currencies = await listLedgerCurrencies(providerId, period);
      for (const currency of currencies) {
        const entry: Record<string, unknown> = { providerId, currency, period };
        try {
          const dry = await commissionDryRun({ providerId, periodStart: start, periodEnd: end, currency });
          if (dry.ok === false) {
            entry.step = "dry_run";
            entry.error = dry.code;
            results.push(entry);
            continue;
          }
          entry.ledgerRows = dry.data.ledger_rows_count;
          entry.commissionMinor = dry.data.rounded_commission_amount_minor;
          if (!dry.data.can_close || Number(dry.data.ledger_rows_count) === 0) {
            entry.step = "skipped";
            entry.missing = dry.data.missing_requirements ?? [];
            results.push(entry);
            continue;
          }

          const closed = await closeAndInvoice({ providerId, periodStart: start, periodEnd: end, currency });
          if (closed.ok === false) {
            entry.step = "close";
            entry.error = closed.code;
            results.push(entry);
            continue;
          }
          entry.invoiceId = closed.invoiceId;

          const issued = await issueCommissionInvoice(closed.invoiceId, null);
          if (issued.ok === false) {
            entry.step = "issue";
            entry.error = issued.code;
            results.push(entry);
            continue;
          }

          const delivered = await deliverCommissionInvoice(closed.invoiceId);
          entry.step = delivered.ok ? "delivered" : "delivery_failed";
          if (delivered.ok === false) entry.error = delivered.code;
          results.push(entry);
        } catch (e) {
          entry.step = "exception";
          entry.error = String((e as Error)?.message ?? e).slice(0, 300);
          results.push(entry);
        }
      }
    }

    return jsonOk(rid, {
      period,
      overdue: overdue.ok === false ? { error: overdue.code } : overdue.data,
      providersProcessed: providerIds.length,
      results,
    });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const code = String(e?.code ?? "").trim();
    if (msg === "cron_secret_missing" || code === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET mangler i env.", 500, "misconfigured");
    }
    if (msg === "forbidden" || code === "forbidden") {
      return jsonErr(rid, "Ugyldig cron secret.", 403, "forbidden");
    }
    captureCronHandlerError("/api/cron/commission-settlement", rid, e);
    return jsonErr(rid, "Uventet feil.", 500, { code: "server_error", detail: msg });
  }
}
