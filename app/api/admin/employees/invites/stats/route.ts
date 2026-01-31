// app/api/admin/employees/invites/stats/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.employees.invites.stats", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = String(scope.companyId ?? "").trim();
  if (!companyId) return jsonErr(409, rid, "SCOPE_MISSING", "Mangler companyId i scope.");

  try {
    const admin = supabaseAdmin();
    const nowIso = new Date().toISOString();

    const totalQ = admin.from("employee_invites").select("id", { count: "exact", head: true }).eq("company_id", companyId);

    const activeQ = admin
      .from("employee_invites")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("used_at", null)
      .gt("expires_at", nowIso);

    const usedQ = admin
      .from("employee_invites")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .not("used_at", "is", null);

    const expiredQ = admin
      .from("employee_invites")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("used_at", null)
      .lt("expires_at", nowIso);

    const [totalR, activeR, usedR, expiredR] = await Promise.all([totalQ, activeQ, usedQ, expiredQ]);

    const anyErr = totalR.error || activeR.error || usedR.error || expiredR.error;
    if (anyErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente invitasjonsstatistikk.", anyErr);

    return jsonOk({
      ok: true,
      rid,
      companyId,
      stats: {
        total: Number(totalR.count ?? 0),
        active: Number(activeR.count ?? 0),
        used: Number(usedR.count ?? 0),
        expired: Number(expiredR.count ?? 0),
      },
    });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}


