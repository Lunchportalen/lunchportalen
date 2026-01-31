// app/api/admin/employees/[userId]/disable/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

type RouteCtx = { params: { userId: string } };

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.employees.disable", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = String(scope.companyId ?? "").trim();
  if (!companyId) return jsonErr(409, rid, "SCOPE_MISSING", "Mangler companyId i scope.");

  const targetUserId = String(ctx?.params?.userId ?? "").trim();
  if (!isUuid(targetUserId)) return jsonErr(400, rid, "INVALID_USER_ID", "Ugyldig userId.");

  const body = await readJson(req);
  const disabled = Boolean((body as any)?.disabled); // true => disable, false => enable

  try {
    const sb = await supabaseServer();

    // 1) read target profile (must be same company and employee)
    const { data: target, error: terr } = await sb
      .from("profiles")
      .select("user_id, company_id, role, disabled_at, email, full_name")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (terr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke lese ansattprofil.", terr);
    if (!target) return jsonErr(404, rid, "NOT_FOUND", "Fant ikke ansatt.");

    if (String((target as any).company_id ?? "") !== companyId) {
      return jsonErr(403, rid, "FORBIDDEN", "Du har ikke tilgang til denne brukeren.");
    }
    if (String((target as any).role ?? "").toLowerCase() !== "employee") {
      return jsonErr(403, rid, "FORBIDDEN_ROLE", "Kun ansatte (employee) kan deaktiveres.");
    }

    // 2) update disabled_at
    const nextDisabledAt = disabled ? new Date().toISOString() : null;

    const { data: updated, error: uerr } = await sb
      .from("profiles")
      .update({ disabled_at: nextDisabledAt })
      .eq("user_id", targetUserId)
      .select("user_id, email, full_name, role, company_id, disabled_at")
      .maybeSingle();

    if (uerr) return jsonErr(500, rid, "UPDATE_FAILED", "Kunne ikke oppdatere ansatt.", uerr);

    // 3) audit (best effort)
    try {
      const actorEmail = scope.email ?? null;
      const actorUserId = String(scope.userId ?? "").trim() || null;

      await sb.from("employee_audit").insert({
        employee_user_id: targetUserId,
        company_id: companyId,
        actor_user_id: actorUserId,
        actor_email: actorEmail,
        action: disabled ? "disable" : "enable",
        diff: { disabled, prev_disabled_at: (target as any).disabled_at ?? null, next_disabled_at: nextDisabledAt },
      });
    } catch {
      // ignore
    }

    return jsonOk({ ok: true, rid, employee: updated ?? null });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}


