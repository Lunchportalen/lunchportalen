export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { parseMonth } from "@/lib/superadmin/invoiceMonthlyDb";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Monthly agreement invoice generation — delegates to prod RPC
 * `lp_generate_agreement_invoices_for_period` (run/line schema).
 */
export async function POST(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return s?.response ?? s?.res;

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.invoices.generate.POST", ["superadmin"]);
  if (deny) return deny;

  const url = new URL(req.url);
  const parsed = parseMonth(safeStr(url.searchParams.get("month")));
  if (!parsed) return jsonErr(ctx.rid, "month ma vaere pa formatet YYYY-MM.", 400, "BAD_REQUEST");

  const admin = supabaseAdmin();

  try {
    const { data, error } = await admin.rpc("lp_generate_agreement_invoices_for_period", {
      p_period_start: parsed.monthStart,
      p_period_end: parsed.monthEnd,
      p_request_rid: safeStr(ctx?.rid),
    });

    if (error) {
      return jsonErr(ctx.rid, "Kunne ikke generere avtalefakturaer.", 500, {
        code: "INVOICE_GENERATE_RPC_FAILED",
        detail: { message: safeStr(error?.message ?? error) },
      });
    }

    const payload = (data ?? {}) as Record<string, unknown>;
    const generated = Math.max(0, Math.floor(safeNum(payload.generated)));
    const skipped = Math.max(0, Math.floor(safeNum(payload.skipped)));
    const errorCount = Math.max(0, Math.floor(safeNum(payload.error_count)));

    return jsonOk(ctx.rid, {
      month: parsed.month,
      period_start: parsed.monthStart,
      period_end: parsed.monthEnd,
      created: generated,
      updated: 0,
      skipped,
      exportQueued: generated,
      errors: errorCount,
      rpc: payload,
      meta: { generator: "lp_generate_agreement_invoices_for_period" },
    });
  } catch (error: unknown) {
    return jsonErr(ctx.rid, "Invoice generate feilet.", 500, {
      code: "INVOICE_GENERATE_FAILED",
      detail: { message: safeStr((error as Error)?.message ?? error) },
    });
  }
}
