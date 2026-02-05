// app/api/admin/users/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function asLimit(v: any, def = 200) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(500, Math.max(1, Math.floor(n)));
}
function normCompanyStatus(v: any) {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  if (s === "PENDING") return "PENDING";
  return "UNKNOWN";
}

export async function GET(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.users.read", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(scope.companyId);
  const userId = safeStr(scope.userId);

  if (!userId) return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTH");
  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  try {
    const sb = await supabaseServer();

    // status gate (firma må være ACTIVE)
    const { data: company, error: compErr } = await sb.from("companies").select("id,status").eq("id", companyId).maybeSingle();

    if (compErr) return jsonErr(rid, "Kunne ikke lese firma.", 500, { code: "COMPANY_READ_FAILED", detail: { message: compErr.message } });
    if (!company) return jsonErr(rid, "Fant ikke firma.", 404, "COMPANY_NOT_FOUND");

    const status = normCompanyStatus((company as any).status);
    if (status !== "ACTIVE") {
      return jsonErr(rid, "Firma er ikke aktivt.", 403, { code: "COMPANY_NOT_ACTIVE", detail: { status } });
    }

    const url = new URL(req.url);
    const q = safeStr(url.searchParams.get("q"));
    const limit = asLimit(url.searchParams.get("limit"), 200);

    let query = sb
      .from("profiles")
      .select("id,full_name,department,created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (q) query = query.ilike("full_name", `%${q}%`);

    const { data: rows, error } = await query;
    if (error) return jsonErr(rid, "Kunne ikke hente ansatte.", 500, { code: "QUERY_FAILED", detail: { message: error.message } });

    return jsonOk(rid, {
      companyId,
      count: (rows ?? []).length,
      users: rows ?? [],
    });
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: String(e?.message ?? e) } });
  }
}
