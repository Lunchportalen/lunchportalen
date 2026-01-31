// app/api/admin/locations/audit/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


// ✅ Dag-10 helpers
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
  );
}

function clampInt(v: any, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return Math.min(max, Math.max(min, i));
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export async function GET(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  // 1) Scope (NY SIGNATUR: Response | { ok:true, ctx })
  const a = await scopeOr401(req);
  if (a instanceof Response) return a;
  const ctx = a.ctx;

  // 2) Roles: superadmin OR company_admin (NY SIGNATUR)
  const denyRole = requireRoleOr403(ctx, "admin.locations.audit", ["superadmin", "company_admin"]);
  if (denyRole) return denyRole;

  const supabase = await supabaseServer();
  const url = new URL(req.url);

  const locationId = safeStr(url.searchParams.get("location_id"));
  const mode = safeStr(url.searchParams.get("mode") ?? "latest").toLowerCase(); // latest | list
  const limit = clampInt(url.searchParams.get("limit"), 1, 50, 10);

  if (!isUuid(locationId)) {
    return jsonErr(ctx, "bad_request", "Mangler/ugyldig location_id.");
  }

  // 3) Tenant lock for company_admin: location must belong to own company
  if (ctx.scope.role !== "superadmin") {
    const denyScope = requireCompanyScopeOr403(ctx);
    if (denyScope) return denyScope;

    const myCompanyId = safeStr(ctx.scope.companyId);

    const { data: loc, error: locErr } = await supabase
      .from("company_locations")
      .select("id,company_id")
      .eq("id", locationId)
      .maybeSingle();

    if (locErr) return jsonErr(ctx, "db_error", "Databasefeil.", { message: locErr.message });
    if (!loc) return jsonErr(ctx, "not_found", "Lokasjon finnes ikke.");
    if (safeStr((loc as any).company_id) !== myCompanyId) return jsonErr(ctx, "forbidden", "Ingen tilgang.");
  }

  // 4) Read audit
  if (mode === "list") {
    const { data, error } = await supabase
      .from("location_audit")
      .select("id,location_id,company_id,actor_email,actor_user_id,action,created_at,diff")
      .eq("location_id", locationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return jsonErr(ctx, "db_error", "Databasefeil.", { message: error.message });

    return jsonOk(ctx, { ok: true, items: data ?? [] });
  }

  // default: latest
  const { data: row, error } = await supabase
    .from("location_audit")
    .select("id,location_id,company_id,actor_email,actor_user_id,action,created_at,diff")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return jsonErr(ctx, "db_error", "Databasefeil.", { message: error.message });

  return jsonOk(ctx, { ok: true, latest: row ?? null });
}


