// app/api/superadmin/companies/[companyId]/archive/summary/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

type RouteCtx = { params: { companyId: string } | Promise<{ companyId: string }> };

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

function errDetail(e: any) {
  if (!e) return null;
  if (typeof e === "string") return e;
  if (e instanceof Error) return { name: e.name, message: e.message };
  try {
    return JSON.parse(JSON.stringify(e));
  } catch {
    return String(e);
  }
}

function isMissingColumn(err: any) {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "").toLowerCase();
  return code === "42703" || msg.includes("column") || msg.includes("schema cache");
}

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.companies.archive.summary.GET", ["superadmin"]);
  if (deny) return deny;

  const params = await Promise.resolve(ctx.params as any);
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(a.rid, "Ugyldig companyId.", 400, "BAD_REQUEST");

  const admin = supabaseAdmin();

  const companyRes = await admin
    .from("companies")
    .select("id,name,orgnr,status,deleted_at,deleted_by,delete_reason")
    .eq("id", companyId)
    .maybeSingle();

  if (companyRes.error) {
    return jsonErr(a.rid, "Kunne ikke hente firma.", 500, { code: "COMPANY_LOOKUP_FAILED", detail: errDetail(companyRes.error) });
  }
  if (!companyRes.data?.id) return jsonErr(a.rid, "Fant ikke firma.", 404, "NOT_FOUND");

  const delRes = await admin
    .from("company_deletions")
    .select("company_id,company_name_snapshot,orgnr_snapshot,deleted_at,deleted_by,reason,counts_json,mode")
    .eq("company_id", companyId)
    .maybeSingle();

  if (delRes.error) {
    return jsonErr(a.rid, "Kunne ikke hente arkivlogg.", 500, { code: "ARCHIVE_LOG_LOOKUP_FAILED", detail: errDetail(delRes.error) });
  }
  if (!delRes.data?.company_id) return jsonErr(a.rid, "Firma er ikke arkivert.", 404, "NOT_ARCHIVED");

  let deletedByLabel: string | null = null;
  const deletedBy = safeStr((delRes.data as any)?.deleted_by) || null;
  if (deletedBy) {
    const prof = await admin
      .from("profiles")
      .select("email,name,full_name")
      .eq("user_id", deletedBy)
      .maybeSingle();

    if (!prof.error && prof.data) {
      const full = safeStr((prof.data as any).full_name);
      const name = safeStr((prof.data as any).name);
      const email = safeStr((prof.data as any).email);
      deletedByLabel = full || name || email || deletedBy;
    } else {
      deletedByLabel = deletedBy;
    }
  }

  const ordersRes = await admin
    .from("orders")
    .select("line_total,currency")
    .eq("company_id", companyId);

  if (ordersRes.error) {
    if (isMissingColumn(ordersRes.error)) {
      return jsonErr(a.rid, "Ordre-snapshot mangler line_total/currency.", 500, { code: "ORDER_SNAPSHOT_MISSING", detail: errDetail(ordersRes.error) });
    }
    return jsonErr(a.rid, "Kunne ikke hente ordre for økonomi.", 500, { code: "ORDERS_LOOKUP_FAILED", detail: errDetail(ordersRes.error) });
  }

  const rows = ordersRes.data ?? [];
  const currencySet = new Set<string>();
  let totalRevenue = 0;

  for (const r of rows as any[]) {
    const v = toNum(r?.line_total);
    if (v === null) {
      return jsonErr(a.rid, "Ordre-snapshot mangler line_total.", 500, { code: "ORDER_SNAPSHOT_INVALID", detail: { line_total: r?.line_total } });
    }
    totalRevenue += v;

    const c = safeStr(r?.currency);
    if (!c) {
      return jsonErr(a.rid, "Ordre-snapshot mangler currency.", 500, { code: "ORDER_SNAPSHOT_INVALID", detail: { currency: r?.currency } });
    }
    currencySet.add(c);
  }

  if (currencySet.size > 1) {
    return jsonErr(a.rid, "Flere valutaer funnet i ordre-historikk.", 500, { code: "MULTI_CURRENCY", detail: { currencies: Array.from(currencySet) } });
  }

  const currency = currencySet.values().next().value ?? null;

  return jsonOk(a.rid, {
    company: companyRes.data,
    deletion: {
      ...(delRes.data as any),
      deleted_by_label: deletedByLabel,
    },
    snapshot: {
      name: (delRes.data as any)?.company_name_snapshot ?? null,
      orgnr: (delRes.data as any)?.orgnr_snapshot ?? null,
    },
    totals: {
      orders: rows.length,
      revenue: totalRevenue,
      currency,
    },
  }, 200);
}
