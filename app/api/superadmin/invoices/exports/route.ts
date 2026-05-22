export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import {
  isRunPeriodLocked,
  loadLinesForRuns,
  loadRunsOverlappingMonth,
  loadTripletexInvoicesForRuns,
  normalizeTripletexExportStatus,
  parseMonth,
  tripletexKey,
} from "@/lib/superadmin/invoiceMonthlyDb";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parsePagination(inputLimit: unknown, inputOffset: unknown): { limit: number; offset: number } {
  const limitRaw = Math.floor(safeNum(inputLimit));
  const offsetRaw = Math.floor(safeNum(inputOffset));
  const limit = limitRaw > 0 ? Math.min(limitRaw, 500) : 100;
  const offset = offsetRaw >= 0 ? offsetRaw : 0;
  return { limit, offset };
}

export async function GET(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return s?.response ?? s?.res;

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.invoices.exports.GET", ["superadmin"]);
  if (deny) return deny;

  const url = new URL(req.url);
  const parsedMonth = parseMonth(url.searchParams.get("month") ?? "");
  if (!parsedMonth) return jsonErr(ctx.rid, "month ma vaere pa formatet YYYY-MM.", 400, "BAD_REQUEST");

  const { limit, offset } = parsePagination(url.searchParams.get("limit"), url.searchParams.get("offset"));
  const admin = supabaseAdmin();

  try {
    const runs = await loadRunsOverlappingMonth(admin, parsedMonth);
    const runIds = runs.map((r) => r.id);
    const runsById = new Map(runs.map((r) => [r.id, r]));
    const lines = await loadLinesForRuns(admin, runIds);
    const txRows = await loadTripletexInvoicesForRuns(admin, runIds);
    const txByKey = new Map(txRows.map((t) => [tripletexKey(t.run_id, t.company_id), t]));

    const mapped = lines.map((line) => {
      const run = runsById.get(String(line.run_id ?? ""));
      const tx = txByKey.get(tripletexKey(String(line.run_id ?? ""), String(line.company_id ?? "")));
      const exportStatus = normalizeTripletexExportStatus(tx?.status);
      const locked = isRunPeriodLocked(run?.status, tx?.external_invoice_id ?? null);

      return {
        reference: String(line.id),
        company_id: String(line.company_id ?? ""),
        month: parsedMonth.month,
        quantity: Math.max(0, Math.floor(safeNum(line.quantity))),
        unit_price: safeNum(line.unit_price_nok),
        amount: safeNum(line.amount_nok),
        currency: "NOK",
        locked,
        export_status: exportStatus,
        export_last_error: tx?.last_error ?? null,
        tripletex_vat_code: null,
        product_tier: line.tier ?? null,
        product_name: line.description ?? line.tier ?? null,
        external_id: tx?.external_invoice_id ?? null,
        exported_at: tx?.updated_at ?? null,
        run_id: String(line.run_id ?? ""),
      };
    });

    mapped.sort((a, b) => a.reference.localeCompare(b.reference));
    const total = mapped.length;
    const rows = mapped.slice(offset, offset + limit);

    return jsonOk(ctx.rid, {
      month: parsedMonth.month,
      pagination: {
        limit,
        offset,
        total,
        returned: rows.length,
      },
      rows,
    });
  } catch (error: unknown) {
    return jsonErr(ctx.rid, "Invoice exports endpoint feilet.", 500, {
      code: "INVOICE_EXPORTS_ENDPOINT_FAILED",
      detail: { message: safeStr((error as Error)?.message ?? error) },
    });
  }
}
