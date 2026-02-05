// app/api/superadmin/firms/[companyId]/employees/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function norm(v: any) {
  return safeStr(v).toLowerCase();
}

function safeInt(v: any, def: number, min: number, max: number) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

type Ctx = { params: { companyId: string } | Promise<{ companyId: string }> };

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = await scopeOr401(req);
  if (!s?.ok) return (s?.response as Response) || (s?.res as Response) || jsonErr("rid_missing", "Du må være innlogget.", 401, "UNAUTHENTICATED");

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.firms.employees.GET", ["superadmin"]);
  if (deny) return deny;

  const params = await ctx.params;
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(a.rid, "Ugyldig companyId.", 400, "BAD_REQUEST");

  try {
    const url = new URL(req.url);

    const q = norm(url.searchParams.get("q") ?? "");
    const page = safeInt(url.searchParams.get("page"), 1, 1, 10_000);
    const limit = safeInt(url.searchParams.get("limit"), 50, 1, 200);

    const admin = supabaseAdmin();

    let query = admin
      .from("profiles")
      .select("user_id,email,name,department,location_id,role,is_active,disabled_at,deleted_at,last_active_at,created_at", { count: "exact" })
      .eq("company_id", companyId)
      .eq("role", "employee");

    if (q) {
      // Note: postgrest OR-string. q er allerede normalisert (lowercase),
      // men vi bruker raw q i like for best UX.
      query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%,department.ilike.%${q}%`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);

    if (error) {
      return jsonErr(a.rid, "Kunne ikke hente ansatte.", 500, { code: "DB_ERROR", detail: error });
    }

    return jsonOk(
      a,
      {
        ok: true,
        rid: a.rid,
        page,
        limit,
        total: Number(count ?? 0),
        employees: (data ?? []).map((r: any) => ({
          user_id: String(r.user_id),
          email: r.email ?? null,
          name: r.name ?? null,
          department: r.department ?? null,
          location_id: r.location_id ? String(r.location_id) : null,
          role: r.role ?? null,
          is_active: Boolean(r.is_active),
          disabled_at: r.disabled_at ?? null,
          deleted_at: r.deleted_at ?? null,
          last_active_at: r.last_active_at ?? null,
          created_at: r.created_at ?? null,
        })),
      },
      200
    );
  } catch (e: any) {
    return jsonErr(a.rid, "Kunne ikke hente ansatte.", 500, { code: "SERVER_ERROR", detail: { message: String(e?.message ?? e) } });
  }
}
