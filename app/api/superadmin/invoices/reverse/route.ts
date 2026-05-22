export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import {
  isRunPeriodLocked,
  loadTripletexInvoicesForRuns,
} from "@/lib/superadmin/invoiceMonthlyDb";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function isUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v);
}

function readLineId(req: NextRequest): string {
  const url = new URL(req.url);
  return safeStr(url.searchParams.get("reference") ?? url.searchParams.get("lineId"));
}

/**
 * K2 OPTION B — credit-note / invoice reversal is deferred.
 * Previously enqueued `invoice.reverse:*` with no Tripletex consumer (dead pipeline).
 */
export async function POST(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return s?.response ?? s?.res;

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.invoices.reverse.POST", ["superadmin"]);
  if (deny) return deny;

  const lineId = readLineId(req);
  if (!lineId) return jsonErr(ctx.rid, "lineId (eller reference som UUID) er påkrevd.", 400, "BAD_REQUEST");

  if (!isUuid(lineId)) {
    return jsonErr(
      ctx.rid,
      "Legacy reference-nøkkel støttes ikke lenger. Bruk invoice_lines.id (UUID).",
      400,
      "LEGACY_REFERENCE_UNSUPPORTED",
    );
  }

  const admin = supabaseAdmin();

  try {
    const { data: line, error: lineError } = await admin
      .from("invoice_lines")
      .select("id, company_id, run_id, quantity")
      .eq("id", lineId)
      .maybeSingle();

    if (lineError) {
      return jsonErr(ctx.rid, "Kunne ikke lese fakturalinje.", 500, {
        code: "INVOICE_LINE_LOOKUP_FAILED",
        detail: { message: safeStr(lineError?.message ?? lineError) },
      });
    }

    if (!line) {
      return jsonErr(ctx.rid, "Fant ikke fakturalinje.", 404, "NOT_FOUND");
    }

    const runId = safeStr((line as any).run_id);
    const companyId = safeStr((line as any).company_id);
    if (!runId || !companyId) {
      return jsonErr(ctx.rid, "Fakturalinje mangler run_id/company_id.", 422, "INVOICE_LINE_INCOMPLETE");
    }

    const { data: runRes, error: runError } = await admin
      .from("invoice_runs")
      .select("id, status")
      .eq("id", runId)
      .maybeSingle();

    if (runError) {
      return jsonErr(ctx.rid, "Kunne ikke lese fakturakjøring.", 500, {
        code: "INVOICE_RUN_LOOKUP_FAILED",
        detail: { message: safeStr(runError?.message ?? runError) },
      });
    }

    const txRows = await loadTripletexInvoicesForRuns(admin, [runId], [companyId]);
    const locked = isRunPeriodLocked((runRes as any)?.status, txRows[0]?.external_invoice_id ?? null);

    if (!locked) {
      return jsonOk(ctx.rid, {
        line_id: lineId,
        reversed: false,
        reason: "NOT_LOCKED",
        message: "Perioden er ikke låst/eksportert — reversal er ikke nødvendig.",
      });
    }

    return jsonErr(
      ctx.rid,
      "Kreditnota/reversal er ikke implementert (K2 deferred). Kontakt drift for manuell korreksjon i Tripletex.",
      501,
      "CREDIT_NOTE_NOT_IMPLEMENTED",
    );
  } catch (error: unknown) {
    return jsonErr(ctx.rid, "Reversal feilet.", 500, {
      code: "INVOICE_REVERSE_FAILED",
      detail: { message: safeStr((error as Error)?.message ?? error) },
    });
  }
}
