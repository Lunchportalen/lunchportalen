// app/api/admin/employees/audit/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

function isUuid(v: unknown) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function clampInt(v: unknown, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return Math.min(max, Math.max(min, i));
}

export async function GET(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.employees.audit.read", ["superadmin", "company_admin"]);
  if (denyRole) return denyRole;

  const url = new URL(req.url);
  const userId = String(url.searchParams.get("user_id") ?? "").trim();
  const mode = String(url.searchParams.get("mode") ?? "latest")
    .trim()
    .toLowerCase(); // latest | list
  const limit = clampInt(url.searchParams.get("limit"), 1, 50, 10);

  if (!isUuid(userId)) return jsonErr(400, rid, "BAD_REQUEST", "Mangler/ugyldig user_id.");

  try {
    const sb = await supabaseServer();

    // Tenant lock for company_admin: employee must belong to own company
    if (scope.role !== "superadmin") {
      const denyScope = requireCompanyScopeOr403(a.ctx);
      if (denyScope) return denyScope;

      const myCompanyId = String(scope.companyId ?? "").trim();

      const { data: prof, error: pErr } = await sb.from("profiles").select("user_id,company_id,role").eq("user_id", userId).maybeSingle();

      if (pErr) return jsonErr(500, rid, "DB_ERROR", "Databasefeil.", pErr);
      if (!prof) return jsonErr(404, rid, "NOT_FOUND", "Ansatt finnes ikke.");

      if (String((prof as any).company_id ?? "") !== String(myCompanyId)) {
        return jsonErr(403, rid, "FORBIDDEN", "Ingen tilgang.");
      }
      if (String((prof as any).role ?? "").toLowerCase() !== "employee") {
        return jsonErr(403, rid, "FORBIDDEN", "Kun employee støttes her.");
      }
    }

    const baseSelect = "id,employee_user_id,company_id,actor_email,actor_user_id,action,created_at,diff";

    if (mode === "list") {
      const { data, error } = await sb
        .from("employee_audit")
        .select(baseSelect)
        .eq("employee_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente audit.", error);
      return jsonOk({ ok: true, rid, items: data ?? [] });
    }

    const { data: row, error } = await sb
      .from("employee_audit")
      .select(baseSelect)
      .eq("employee_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente audit.", error);

    return jsonOk({ ok: true, rid, latest: row ?? null });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}


