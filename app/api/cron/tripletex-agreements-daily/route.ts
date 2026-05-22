export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { osloTodayISODate, isIsoDate } from "@/lib/date/oslo";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { captureCronHandlerError } from "@/lib/http/cronObservability";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function writeAgreementBillingCronAudit(
  action: string,
  today: string,
  rid: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const admin = supabaseAdmin();
  await admin.from("lifecycle_audit_log").insert({
    actor_id: null,
    action,
    entity_type: "agreement_billing_cron",
    entity_id: (metadata.run_id as string) ?? null,
    reason: null,
    metadata: { request_rid: rid, today, ...metadata },
  });
}

async function handleAgreementBillingCron(req: NextRequest) {
  const rid = makeRid("cron_agr_bill");
  const started = Date.now();

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
  const todayQ = (url.searchParams.get("today") ?? "").trim();
  const today = todayQ || osloTodayISODate();

  if (!isIsoDate(today)) {
    return jsonErr(rid, "today må være YYYY-MM-DD", 400, {
      code: "bad_request",
      detail: { today },
    });
  }

  const admin = supabaseAdmin();

  try {
    const { data, error } = await admin.rpc("lp_run_daily_agreement_billing", {
      p_today: today,
      p_request_rid: rid,
    });

    if (error) {
      await writeAgreementBillingCronAudit("agreement_billing_cron_failed", today, rid, {
        ok: false,
        duration_ms: Date.now() - started,
        rpc_error: {
          message: (error as { message?: string })?.message ?? String(error),
          code: (error as { code?: string })?.code ?? null,
        },
      });
      return jsonErr(rid, "lp_run_daily_agreement_billing feilet", 500, {
        code: "rpc_error",
        detail: {
          message: (error as { message?: string })?.message ?? String(error),
          code: (error as { code?: string })?.code ?? null,
          today,
        },
      });
    }

    const result = (data ?? {}) as Record<string, unknown>;
    const generated = Number(result.generated_count ?? 0);
    const skipped = Number(result.skipped_count ?? 0);
    const failed = Number(result.failed_count ?? 0);
    const candidates = Number(result.candidates_count ?? 0);
    const invoiceIds = Array.isArray(result.invoice_ids) ? result.invoice_ids : [];
    const durationMs = Date.now() - started;

    await writeAgreementBillingCronAudit(
      failed > 0 ? "agreement_billing_cron_partial" : "agreement_billing_cron_completed",
      today,
      rid,
      {
        ok: true,
        run_id: result.run_id ?? null,
        duration_ms: durationMs,
        candidates_count: candidates,
        generated_count: generated,
        skipped_count: skipped,
        failed_count: failed,
        invoice_ids: invoiceIds,
      },
    );

    return jsonOk(
      rid,
      {
        ok: true,
        rid,
        today,
        run_id: result.run_id ?? null,
        duration_ms: durationMs,
        candidates_count: candidates,
        generated_count: generated,
        skipped_count: skipped,
        failed_count: failed,
        invoice_ids: invoiceIds,
        errors: result.errors ?? [],
        result,
      },
      200,
    );
  } catch (e: unknown) {
    const message = String((e as Error)?.message ?? e);
    captureCronHandlerError("/api/cron/tripletex-agreements-daily", rid, e, { today });
    await writeAgreementBillingCronAudit("agreement_billing_cron_failed", today, rid, {
      ok: false,
      duration_ms: Date.now() - started,
      message,
    }).catch(() => undefined);
    return jsonErr(rid, "Agreement billing daily cron feilet", 500, {
      code: "server_error",
      detail: { message, today },
    });
  }
}

/** Vercel Cron invokes GET; manual runs may use POST. */
export async function GET(req: NextRequest) {
  return handleAgreementBillingCron(req);
}

export async function POST(req: NextRequest) {
  return handleAgreementBillingCron(req);
}
