export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { captureCronHandlerError } from "@/lib/http/cronObservability";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";

function isIsoMonth01(v: unknown): boolean {
  return typeof v === "string" && /^\d{4}-\d{2}-01$/.test(v);
}

/** First day of the calendar month before `d` (UTC). On 2026-02-01 → 2026-01-01. */
export function previousMonthStartUTC(d = new Date()): string {
  const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  const y = prev.getUTCFullYear();
  const m = String(prev.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

async function writeSaasInvoiceCronAudit(
  action: string,
  invoicePeriod: string,
  rid: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const admin = supabaseAdmin();
  await admin.from("lifecycle_audit_log").insert({
    actor_id: null,
    action,
    entity_type: "saas_invoice_cron",
    entity_id: invoicePeriod,
    reason: null,
    metadata: { request_rid: rid, invoice_period: invoicePeriod, ...metadata },
  });
}

export async function POST(req: NextRequest) {
  const rid = makeRid("cron_saas_inv");

  try {
    requireCronAuth(req);
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? e);
    const code = String((e as { code?: string })?.code ?? "").trim();

    if (msg === "cron_secret_missing" || code === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET mangler i env", 500, "misconfigured");
    }
    if (msg === "forbidden" || code === "forbidden") {
      return jsonErr(rid, "Ugyldig cron secret", 403, "forbidden");
    }
    return jsonErr(rid, "Uventet feil i cron-gate", 500, {
      code: "server_error",
      detail: { message: msg },
    });
  }

  const url = new URL(req.url);
  const periodQ = (url.searchParams.get("period") ?? "").trim();
  const invoicePeriod = periodQ || previousMonthStartUTC();

  if (!isIsoMonth01(invoicePeriod)) {
    return jsonErr(rid, "period må være YYYY-MM-01", 400, {
      code: "bad_request",
      detail: { period: invoicePeriod },
    });
  }

  const admin = supabaseAdmin();

  try {
    const { data, error } = await admin.rpc("lp_generate_saas_invoices_for_period", {
      p_invoice_period: invoicePeriod,
      p_request_rid: rid,
    });

    if (error) {
      await writeSaasInvoiceCronAudit("saas_invoice_cron_failed", invoicePeriod, rid, {
        ok: false,
        rpc_error: {
          message: (error as { message?: string })?.message ?? String(error),
          code: (error as { code?: string })?.code ?? null,
        },
      });
      return jsonErr(rid, "lp_generate_saas_invoices_for_period feilet", 500, {
        code: "rpc_error",
        detail: {
          message: (error as { message?: string })?.message ?? String(error),
          code: (error as { code?: string })?.code ?? null,
          invoice_period: invoicePeriod,
        },
      });
    }

    const result = (data ?? {}) as Record<string, unknown>;
    const generated = Number(result.generated ?? 0);
    const skippedIdempotent = Number(result.skipped_idempotent ?? 0);
    const invoiceIds = Array.isArray(result.invoice_ids) ? result.invoice_ids : [];
    const outboxEvents = generated + skippedIdempotent;

    await writeSaasInvoiceCronAudit("saas_invoice_cron_completed", invoicePeriod, rid, {
      ok: true,
      generated,
      skipped_idempotent: skippedIdempotent,
      error_count: Number(result.error_count ?? 0),
      outbox_events: outboxEvents,
    });

    return jsonOk(
      rid,
      {
        ok: true,
        rid,
        invoice_period: invoicePeriod,
        generated,
        skipped_idempotent: skippedIdempotent,
        outbox_events: outboxEvents,
        error_count: Number(result.error_count ?? 0),
        errors: result.errors ?? [],
        invoice_ids: invoiceIds,
        result,
      },
      200,
    );
  } catch (e: unknown) {
    const message = String((e as Error)?.message ?? e);
    captureCronHandlerError("/api/cron/tripletex-saas-monthly", rid, e, { invoice_period: invoicePeriod });
    await writeSaasInvoiceCronAudit("saas_invoice_cron_failed", invoicePeriod, rid, {
      ok: false,
      message,
    }).catch(() => undefined);
    return jsonErr(rid, "SaaS invoice monthly cron feilet", 500, {
      code: "server_error",
      detail: { message, invoice_period: invoicePeriod },
    });
  }
}
