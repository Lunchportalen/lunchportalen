// app/api/admin/deliveries/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { osloTodayISODate } from "@/lib/date/oslo";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}
function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function safeOpt(v: string | null) {
  const s = safeStr(v);
  return s ? s : null;
}

export async function GET(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.deliveries.read", ["superadmin", "company_admin"]);
  if (denyRole) return denyRole;

  const url = new URL(req.url);

  const date = safeStr(url.searchParams.get("date")) || osloTodayISODate();
  if (!isISODate(date)) {
    return jsonErr(400, rid, "BAD_REQUEST", "Invalid date. Use YYYY-MM-DD.", { date });
  }

  const slot = safeOpt(url.searchParams.get("slot"));
  const locationId = safeOpt(url.searchParams.get("location_id"));
  const requestedCompanyId = safeOpt(url.searchParams.get("company_id")); // superadmin only

  let companyId: string | null = null;

  if (scope.role === "superadmin") {
    companyId = requestedCompanyId; // null => all
  } else {
    const denyScope = requireCompanyScopeOr403(a.ctx);
    if (denyScope) return denyScope;

    companyId = safeStr(scope.companyId) || null;
    if (!companyId) return jsonErr(409, rid, "SCOPE_MISSING", "Mangler company_id i scope.");
  }

  try {
    const sb = await supabaseServer();

    let q = sb
      .from("delivery_confirmations")
      .select("delivery_date, slot, company_id, location_id, confirmed_at, confirmed_by, rid, note")
      .eq("delivery_date", date);

    if (companyId) q = q.eq("company_id", companyId);
    if (locationId) q = q.eq("location_id", locationId);
    if (slot) q = q.eq("slot", slot);

    const { data, error } = await q.order("slot", { ascending: true });
    if (error) return jsonErr(500, rid, "DB_ERROR", "Failed to load deliveries.", { message: error.message });

    return jsonOk({
      ok: true,
      rid,
      date,
      scope: { role: scope.role ?? null, companyId: companyId ?? null },
      deliveries: data ?? [],
    });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}
