export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeStatus(value: unknown): string {
  return safeStr(value).toUpperCase();
}

export async function POST(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return s?.response ?? s?.res;

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.invoices.exports.retry.POST", ["superadmin"]);
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const reference = safeStr((body as any)?.reference);

  if (!reference) {
    return jsonErr(ctx.rid, "reference er paakrevd.", 400, "BAD_REQUEST");
  }

  const admin = supabaseAdmin();

  try {
    const { data: line, error: readError } = await admin
      .from("invoice_lines")
      .select("reference,company_id,locked,export_status")
      .eq("reference", reference)
      .maybeSingle();

    if (readError) {
      return jsonErr(ctx.rid, "Kunne ikke lese fakturalinje for retry.", 500, {
        code: "INVOICE_LINE_READ_FAILED",
        detail: { message: safeStr(readError?.message ?? readError) },
      });
    }

    if (!line) {
      return jsonErr(ctx.rid, "Fakturalinje finnes ikke.", 404, "NOT_FOUND");
    }

    const locked = Boolean((line as any).locked);
    const exportStatus = normalizeStatus((line as any).export_status);

    if (locked || exportStatus === "EXPORTED") {
      return jsonErr(ctx.rid, "Eksportert/låst periode kan ikke retries uten reversal.", 409, "LOCKED_PERIOD");
    }

    if (exportStatus !== "PENDING_EXPORT" && exportStatus !== "FAILED") {
      return jsonErr(ctx.rid, "Ugyldig export_status for retry.", 409, "EXPORT_STATUS_INVALID");
    }

    const { error: resetError } = await admin
      .from("invoice_lines")
      .update({
        export_status: "PENDING_EXPORT",
        export_last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("reference", reference);

    if (resetError) {
      return jsonErr(ctx.rid, "Kunne ikke nullstille export-status for retry.", 500, {
        code: "INVOICE_LINE_RESET_FAILED",
        detail: { message: safeStr(resetError?.message ?? resetError) },
      });
    }

    const { error: enqueueError } = await admin.from("outbox").upsert(
      {
        event_key: `invoice.ready:${reference}`,
        payload: {
          event: "invoice.ready",
          reference,
          companyId: safeStr((line as any).company_id),
          retryRequestedAt: new Date().toISOString(),
          retryRequestedBy: safeStr(ctx?.scope?.userId),
        },
        status: "PENDING",
        attempts: 0,
        last_error: null,
        locked_at: null,
        locked_by: null,
      },
      { onConflict: "event_key" }
    );

    if (enqueueError) {
      return jsonErr(ctx.rid, "Kunne ikke enqueue invoice.ready for retry.", 500, {
        code: "OUTBOX_ENQUEUE_FAILED",
        detail: { message: safeStr(enqueueError?.message ?? enqueueError) },
      });
    }

    return jsonOk(ctx.rid, {
      reference,
      requeued: true,
      export_status: "PENDING_EXPORT",
    });
  } catch (error: any) {
    return jsonErr(ctx.rid, "Retry feilet.", 500, {
      code: "INVOICE_EXPORT_RETRY_FAILED",
      detail: { message: safeStr(error?.message ?? error) },
    });
  }
}
