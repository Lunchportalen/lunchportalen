// GET /api/admin/company/[companyId]/summary — firma-admin ordre-aggregat (RPC)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { isIsoDate, osloNowParts } from "@/lib/date/oslo";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function defaultMonthRangeOslo(): { start: string; end: string } {
  const o = osloNowParts();
  const y = Number(o.yyyy);
  const m = Number(o.mm);
  const start = `${o.yyyy}-${o.mm}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${o.yyyy}-${o.mm}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

type RouteCtx = { params: { companyId: string } | Promise<{ companyId: string }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const params = await Promise.resolve(ctx.params as { companyId?: string });
  const companyId = safeStr(params?.companyId);

  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;

  const { rid, scope } = gate.ctx;

  const denyRole = requireRoleOr403(gate.ctx, "admin.company.summary", ["company_admin", "superadmin"]);
  if (denyRole) return denyRole;

  if (!companyId) {
    return jsonErr(rid, "Mangler firma-id.", 400, "MISSING_COMPANY_ID");
  }

  const denyScope = requireCompanyScopeOr403(gate.ctx, companyId);
  if (denyScope) return denyScope;

  const url = new URL(req.url);
  let start = safeStr(url.searchParams.get("start"));
  let end = safeStr(url.searchParams.get("end"));

  if (!start || !end) {
    const d = defaultMonthRangeOslo();
    if (!start) start = d.start;
    if (!end) end = d.end;
  }

  if (!isIsoDate(start) || !isIsoDate(end)) {
    return jsonErr(rid, "Ugyldig periode (start/end som YYYY-MM-DD).", 422, "INVALID_PERIOD");
  }

  if (end < start) {
    return jsonErr(rid, "period_end må være på eller etter period_start.", 422, "INVALID_PERIOD_RANGE");
  }

  const span =
    (new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / (86400 * 1000);
  if (span > 731) {
    return jsonErr(rid, "Periode for lang (maks 732 dager).", 422, "PERIOD_TOO_LONG");
  }

  try {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    const { data, error } = await sb.rpc("lp_company_order_summary", {
      p_company_id: companyId,
      p_period_start: start,
      p_period_end: end,
    });

    if (error) {
      const msg = String(error.message ?? "");
      const detail = { message: msg, code: (error as { code?: string }).code ?? null };
      if (/UNAUTHENTICATED/i.test(msg)) {
        return jsonErr(rid, "Ikke innlogget (RPC).", 401, "UNAUTHENTICATED", detail);
      }
      if (/FORBIDDEN_NOT_COMPANY_ADMIN/i.test(msg)) {
        return jsonErr(rid, "Ingen tilgang til dette firmaet.", 403, "FORBIDDEN", detail);
      }
      if (/INVALID_PERIOD/i.test(msg) || /PERIOD_TOO_LONG/i.test(msg) || /INVALID_COMPANY_ID/i.test(msg)) {
        return jsonErr(rid, "Ugyldig forespørsel.", 422, "RPC_VALIDATION", detail);
      }
      return jsonErr(rid, "Kunne ikke hente firmasammendrag.", 500, "RPC_FAILED", detail);
    }

    return jsonOk(rid, {
      ...(typeof data === "object" && data !== null ? (data as Record<string, unknown>) : { raw: data }),
      period: { start, end },
      scope_company_id: safeStr(scope.companyId) || null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, "Uventet feil ved firmasammendrag.", 500, "INTERNAL_ERROR", { message: msg });
  }
}
