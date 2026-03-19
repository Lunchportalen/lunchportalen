// app/api/superadmin/enterprise/[groupId]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, denyResponse } from "@/lib/http/routeGuard";

type RouteCtx = { params: { groupId: string } | Promise<{ groupId: string }> };

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function toInt(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : fallback;
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s = await scopeOr401(req);
  if (!s.ok) return denyResponse(s);
  const authCtx = s.ctx;
  const deny = requireRoleOr403(authCtx, "api.superadmin.enterprise.group.GET", ["superadmin"]);
  if (deny) return deny;

  const params = await Promise.resolve(ctx.params as any);
  const groupId = safeStr(params?.groupId);
  if (!isUuid(groupId)) return jsonErr(authCtx.rid, "Ugyldig groupId.", 400, "BAD_REQUEST");

  const url = new URL(req.url);
  const page = toInt(url.searchParams.get("page"), 1);
  const limit = Math.min(100, Math.max(1, toInt(url.searchParams.get("limit"), 25)));
  const offset = (page - 1) * limit;

  try {
    const admin = supabaseAdmin();

    const groupRes = await admin
      .from("enterprise_groups")
      .select("id,name,orgnr,created_at")
      .eq("id", groupId)
      .maybeSingle();

    if (groupRes.error) {
      return jsonErr(authCtx.rid, "Kunne ikke hente konsern.", 500, { code: "DB_ERROR", detail: groupRes.error });
    }
    if (!groupRes.data?.id) return jsonErr(authCtx.rid, "Fant ikke konsern.", 404, "NOT_FOUND");

    const companiesRes = await admin
      .from("companies")
      .select("id,name,orgnr,status,created_at", { count: "exact" })
      .eq("enterprise_group_id", groupId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (companiesRes.error) {
      return jsonErr(authCtx.rid, "Kunne ikke hente selskaper.", 500, { code: "DB_ERROR", detail: companiesRes.error });
    }

    const companyRows = Array.isArray(companiesRes.data) ? companiesRes.data : [];
    const companies = companyRows.map((c: any) => ({
      id: safeStr(c?.id),
      name: safeStr(c?.name) || "Ukjent firma",
      orgnr: safeStr(c?.orgnr) || null,
      status: safeStr(c?.status) || null,
      created_at: c?.created_at ?? null,
    }));

    const companyIds = companies.map((c) => c.id).filter(Boolean);
    let locations: any[] = [];

    if (companyIds.length) {
      const locRes = await admin
        .from("company_locations")
        .select("id,company_id,name,address,status,created_at")
        .in("company_id", companyIds)
        .order("created_at", { ascending: false });

      if (locRes.error) {
        return jsonErr(authCtx.rid, "Kunne ikke hente lokasjoner.", 500, { code: "DB_ERROR", detail: locRes.error });
      }

      locations = Array.isArray(locRes.data) ? locRes.data : [];
    }

    const locationsByCompany = new Map<string, any[]>();
    for (const loc of locations) {
      const cid = safeStr((loc as any)?.company_id);
      if (!cid) continue;
      const arr = locationsByCompany.get(cid) ?? [];
      arr.push({
        id: safeStr((loc as any)?.id),
        name: safeStr((loc as any)?.name) || null,
        address: safeStr((loc as any)?.address) || null,
        status: safeStr((loc as any)?.status) || null,
        created_at: (loc as any)?.created_at ?? null,
      });
      locationsByCompany.set(cid, arr);
    }

    const companiesWithLocations = companies.map((c) => {
      const locs = locationsByCompany.get(c.id) ?? [];
      return { ...c, locations: locs, location_count: locs.length };
    });

    return jsonOk(authCtx.rid, {
      group: {
        id: safeStr(groupRes.data?.id),
        name: safeStr(groupRes.data?.name),
        orgnr: safeStr(groupRes.data?.orgnr) || null,
        created_at: groupRes.data?.created_at ?? null,
      },
      page,
      limit,
      total: Number(companiesRes.count ?? 0),
      companies: companiesWithLocations,
    });
  } catch (e: any) {
    return jsonErr(authCtx.rid, "Uventet feil.", 500, { code: "SERVER_ERROR", detail: String(e?.message ?? e) });
  }
}
