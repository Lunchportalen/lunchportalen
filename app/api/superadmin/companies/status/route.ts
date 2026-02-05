// app/api/superadmin/companies/status/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

/* =========================================================
   Types / constants
========================================================= */

const STATUSES = ["pending", "active", "paused", "closed"] as const;
type CompanyStatus = (typeof STATUSES)[number];

type Counts = Record<CompanyStatus, number>;

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function isCompanyStatus(v: any): v is CompanyStatus {
  const s = safeStr(v).toLowerCase();
  return (STATUSES as readonly string[]).includes(s);
}

/* =========================================================
   Guards helpers (match mixed return contracts)
========================================================= */

// scopeOr401 / requireRoleOr403 kan i repoet returnere:
// - Response direkte
// - { ok:false, response|res }
// - { ok:true, ctx }
function asDenyResponse(x: any): Response | null {
  if (!x) return null;
  if (x instanceof Response) return x;
  if (x?.response instanceof Response) return x.response as Response;
  if (x?.res instanceof Response) return x.res as Response;
  return null;
}

function denyResponse(s: any): Response {
  const direct = asDenyResponse(s);
  if (direct) return direct;

  const rid = safeStr(s?.ctx?.rid) || "rid_missing";
  // NB: jsonErr-signaturen deres brukes begge veier (ctx eller {rid})
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

/* =========================================================
   Body parsing (safe, never throws)
========================================================= */

async function readJsonSafe(req: NextRequest): Promise<any> {
  try {
    const t = await req.text();
    if (!t) return {};
    try {
      return JSON.parse(t);
    } catch {
      return {};
    }
  } catch {
    return {};
  }
}

/* =========================================================
   GET: status overview (counts)
========================================================= */

export async function GET(req: NextRequest): Promise<Response> {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;

  // requireRoleOr403 kan returnere Response (deny) eller falsy (allow)
  const deny = requireRoleOr403(ctx, "api.superadmin.companies.status.GET", ["superadmin"]);
  const denyRes = asDenyResponse(deny);
  if (denyRes) return denyRes;

  try {
    const admin = supabaseAdmin();

    const counts: Counts = { pending: 0, active: 0, paused: 0, closed: 0 };

    // 4 små head-count queries (stabilt og raskt nok)
    for (const st of STATUSES) {
      const { count, error } = await admin
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("status", st);

      if (error) {
        return jsonErr(ctx.rid, "Kunne ikke hente status-oversikt.", 500, { code: "DB_ERROR", detail: {
          status: st,
          error,
        } });
      }

      counts[st] = Number(count ?? 0);
    }

    const total = STATUSES.reduce((sum, st) => sum + counts[st], 0);

    return jsonOk(ctx.rid, {
        ok: true,
        rid: ctx.rid,
        total,
        counts,
      }, 200);
  } catch (e: any) {
    return jsonErr(ctx.rid, "Kunne ikke hente status-oversikt.", 500, { code: "SERVER_ERROR", detail: {
      message: safeStr(e?.message ?? e),
    } });
  }
}

/* =========================================================
   POST: set company status (superadmin-only)
========================================================= */

export async function POST(req: NextRequest): Promise<Response> {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;

  const deny = requireRoleOr403(ctx, "api.superadmin.companies.status.POST", ["superadmin"]);
  const denyRes = asDenyResponse(deny);
  if (denyRes) return denyRes;

  try {
    const body = await readJsonSafe(req);

    const companyId = safeStr(body?.companyId);
    const statusRaw = safeStr(body?.status).toLowerCase();

    if (!companyId) {
      return jsonErr(ctx.rid, "Mangler companyId.", 400, "BAD_INPUT");
    }
    if (!isCompanyStatus(statusRaw)) {
      return jsonErr(ctx.rid, "Ugyldig status.", 400, "BAD_INPUT");
    }

    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("companies")
      .update({ status: statusRaw })
      .eq("id", companyId)
      .select("id,status,updated_at")
      .maybeSingle();

    if (error) {
      return jsonErr(ctx.rid, "Kunne ikke oppdatere firmastatus.", 500, { code: "DB_ERROR", detail: { error } });
    }
    if (!data?.id) {
      return jsonErr(ctx.rid, "Firma ikke funnet.", 404, "NOT_FOUND");
    }

    return jsonOk(ctx.rid, {
        ok: true,
        rid: ctx.rid,
        data: {
          id: safeStr(data.id),
          status: safeStr((data as any).status).toLowerCase(),
          updated_at: safeStr((data as any).updated_at),
        },
      }, 200);
  } catch (e: any) {
    return jsonErr(ctx.rid, "Kunne ikke oppdatere firmastatus.", 500, { code: "SERVER_ERROR", detail: {
      message: safeStr(e?.message ?? e),
    } });
  }
}


