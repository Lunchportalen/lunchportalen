// app/api/admin/agreements/current/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, resolveAdminTenantCompanyId } from "@/lib/http/routeGuard";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function GET(req: NextRequest) {
  try {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    const gate = await scopeOr401(req);
    if (gate.ok === false) return gate.res;
    const ctx = gate.ctx;

    const denyRole = requireRoleOr403(ctx, "admin.agreements.current", ["company_admin", "superadmin"]);
    if (denyRole) return denyRole;

    const tenant = resolveAdminTenantCompanyId(ctx, req);
    if (tenant.ok === false) return tenant.res;
    const companyId = tenant.companyId;

    const { data, error } = await sb
      .from("agreements")
      .select("*")
      .eq("company_id", companyId)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return jsonErr(ctx.rid, "Kunne ikke hente avtale.", 400, { code: "DB_ERROR", detail: { message: error.message } });

    return jsonOk(ctx.rid, { agreement: data ?? null });
  } catch (e: any) {
    const rid = makeRid();
    return jsonErr(rid, "Uventet feil.", 500, { code: "INTERNAL_ERROR", detail: { message: safeStr(e?.message ?? e) } });
  }
}
