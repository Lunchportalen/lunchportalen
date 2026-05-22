export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import {
  isRunPeriodLocked,
  loadTripletexInvoicesForRuns,
  normalizeTripletexExportStatus,
} from "@/lib/superadmin/invoiceMonthlyDb";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v);
}

export async function POST(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return s?.response ?? s?.res;

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.invoices.exports.retry.POST", ["superadmin"]);
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const lineId = safeStr((body as any)?.lineId ?? (body as any)?.reference);

  if (!lineId) {
    return jsonErr(ctx.rid, "lineId (eller reference som UUID) er paakrevd.", 400, "BAD_REQUEST");
  }

  if (!isUuid(lineId)) {
    return jsonErr(ctx.rid, "Legacy reference-nøkkel støttes ikke. Bruk invoice_lines.id.", 400, "LEGACY_REFERENCE_UNSUPPORTED");
  }

  const admin = supabaseAdmin();

  try {
    const { data: line, error: readError } = await admin
      .from("invoice_lines")
      .select("id, company_id, run_id, quantity")
      .eq("id", lineId)
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

    const runId = safeStr((line as any).run_id);
    const companyId = safeStr((line as any).company_id);
    if (!runId || !companyId) {
      return jsonErr(ctx.rid, "Fakturalinje mangler run_id/company_id.", 422, "INVOICE_LINE_INCOMPLETE");
    }

    const { data: runRes } = await admin.from("invoice_runs").select("id, status").eq("id", runId).maybeSingle();
    const txRows = await loadTripletexInvoicesForRuns(admin, [runId], [companyId]);
    const tx = txRows[0];
    const locked = isRunPeriodLocked((runRes as any)?.status, tx?.external_invoice_id ?? null);
    const exportStatus = normalizeTripletexExportStatus(tx?.status);

    if (locked || exportStatus === "EXPORTED") {
      return jsonErr(ctx.rid, "Eksportert/låst periode kan ikke retries uten reversal.", 409, "LOCKED_PERIOD");
    }

    if (exportStatus !== "PENDING_EXPORT" && exportStatus !== "FAILED") {
      return jsonErr(ctx.rid, "Ugyldig export-status for retry.", 409, "EXPORT_STATUS_INVALID");
    }

    if (tx?.id) {
      const { error: resetError } = await admin
        .from("tripletex_invoices")
        .update({
          status: "PENDING",
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tx.id);

      if (resetError) {
        return jsonErr(ctx.rid, "Kunne ikke nullstille Tripletex-sync for retry.", 500, {
          code: "TRIPLETEX_INVOICE_RESET_FAILED",
          detail: { message: safeStr(resetError?.message ?? resetError) },
        });
      }
    }

    return jsonOk(ctx.rid, {
      line_id: lineId,
      run_id: runId,
      requeued: Boolean(tx?.id),
      export_status: "PENDING_EXPORT",
      message: tx?.id
        ? "Tripletex-sync nullstilt. Automatisk re-eksport krever aktiv worker for run-basert pipeline."
        : "Ingen tripletex_invoices-rad — opprett run/sync før retry.",
    });
  } catch (error: unknown) {
    return jsonErr(ctx.rid, "Retry feilet.", 500, {
      code: "INVOICE_EXPORT_RETRY_FAILED",
      detail: { message: safeStr((error as Error)?.message ?? error) },
    });
  }
}
