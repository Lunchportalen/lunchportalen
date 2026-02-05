// app/api/admin/employees/disable/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

type Body = {
  user_id: string;
  disabled: boolean;
  reason?: string | null;
};

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

export async function POST(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.employees.disable.bulk", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = String(scope.companyId ?? "").trim();
  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  const body = (await readJson(req)) as Partial<Body>;
  const userId = String((body as any)?.user_id ?? "").trim();

  if (!isUuid(userId)) return jsonErr(rid, "Ugyldig user_id.", 400, "INVALID_USER_ID");

  const disabled = Boolean((body as any)?.disabled);
  const reason = safeText((body as any)?.reason);

  try {
    const admin = supabaseAdmin();

    // Viktig: schema hos dere bruker profiles.id som userId
    const { data: target, error: tErr } = await admin.from("profiles").select("id, company_id, role").eq("id", userId).maybeSingle();

    if (tErr) return jsonErr(rid, "Kunne ikke lese ansatt.", 500, { code: "DB_ERROR", detail: { message: tErr.message } });
    if (!target) return jsonErr(rid, "Fant ikke ansatt.", 404, "NOT_FOUND");

    if (String((target as any).company_id ?? "") !== companyId) {
      return jsonErr(rid, "Kan kun endre ansatte i eget firma.", 403, "FORBIDDEN");
    }
    if (String((target as any).role ?? "").toLowerCase() !== "employee") {
      return jsonErr(rid, "Kun ansatte kan deaktiveres her.", 400, "INVALID_TARGET");
    }

    const patch = disabled
      ? { disabled_at: new Date().toISOString(), disabled_reason: reason ?? "Deaktivert av firma-admin" }
      : { disabled_at: null, disabled_reason: null };

    const { error: uErr } = await admin.from("profiles").update(patch).eq("id", userId);
    if (uErr) return jsonErr(rid, "Kunne ikke oppdatere ansatt.", 500, { code: "DB_ERROR", detail: { message: uErr.message } });

    return jsonOk(rid, { user_id: userId, disabled }, 200);
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: String(e?.message ?? e) } });
  }
}
