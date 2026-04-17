// app/api/admin/employees/audit/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, resolveAdminTenantCompanyId } from "@/lib/http/routeGuard";

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

  const { rid } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.employees.audit.read", ["superadmin", "company_admin"]);
  if (denyRole) return denyRole;

  const tenant = resolveAdminTenantCompanyId(a.ctx, req);
  if (tenant.ok === false) return tenant.res;
  const myCompanyId = tenant.companyId;

  const url = new URL(req.url);
  const userId = String(url.searchParams.get("user_id") ?? "").trim();
  const mode = String(url.searchParams.get("mode") ?? "latest")
    .trim()
    .toLowerCase(); // latest | list
  const limit = clampInt(url.searchParams.get("limit"), 1, 50, 10);

  if (!isUuid(userId)) return jsonErr(rid, "Mangler/ugyldig user_id.", 400, "BAD_REQUEST");

  try {
    const sb = await supabaseServer();

    const { data: prof, error: pErr } = await sb.from("profiles").select("user_id,company_id,role").eq("user_id", userId).maybeSingle();

    if (pErr) return jsonErr(rid, "Databasefeil.", 500, { code: "DB_ERROR", detail: pErr });
    if (!prof) return jsonErr(rid, "Ansatt finnes ikke.", 404, "NOT_FOUND");

    if (String((prof as any).company_id ?? "") !== String(myCompanyId)) {
      return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN");
    }
    if (String((prof as any).role ?? "").toLowerCase() !== "employee") {
      return jsonErr(rid, "Kun employee støttes her.", 403, "FORBIDDEN");
    }

    const baseSelect = "id,employee_user_id,company_id,actor_email,actor_user_id,action,created_at,diff";

    if (mode === "list") {
      const { data, error } = await sb
        .from("employee_audit")
        .select(baseSelect)
        .eq("employee_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) return jsonErr(rid, "Kunne ikke hente audit.", 500, { code: "DB_ERROR", detail: error });
      return jsonOk(rid, { items: data ?? [] });
    }

    const { data: row, error } = await sb
      .from("employee_audit")
      .select(baseSelect)
      .eq("employee_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return jsonErr(rid, "Kunne ikke hente audit.", 500, { code: "DB_ERROR", detail: error });

    return jsonOk(rid, { latest: row ?? null });
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: String(e?.message ?? e) } });
  }
}
