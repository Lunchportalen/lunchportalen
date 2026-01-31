// app/api/admin/employees/list/route.ts

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

  const denyRole = requireRoleOr403(a.ctx, "admin.employees.list", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = String(scope.companyId ?? "").trim();
  if (!companyId) return jsonErr(409, rid, "SCOPE_MISSING", "Mangler companyId i scope.");

  try {
    const admin = supabaseAdmin();

    const { data: rows, error: rowsErr } = await admin
      .from("profiles")
      .select("id, name, full_name, email, role, created_at, disabled_at, disabled_reason")
      .eq("company_id", companyId)
      .in("role", ["employee"])
      .order("created_at", { ascending: false });

    if (rowsErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente ansatte.", { message: rowsErr.message });

    return jsonOk({
      ok: true,
      rid,
      companyId,
      employees: (rows ?? []).map((r: any) => ({
        user_id: r.id, // profiles.id = auth.user.id
        name: r.full_name ?? r.name ?? null,
        email: r.email ?? null,
        role: r.role,
        created_at: r.created_at,
        disabled_at: r.disabled_at ?? null,
        disabled_reason: r.disabled_reason ?? null,
      })),
    });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}


