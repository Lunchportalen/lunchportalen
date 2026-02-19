// app/api/superadmin/companies/stats/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

export async function GET(req: NextRequest): Promise<Response> {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.companies.stats.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const admin = supabaseAdmin();

    const [totalRes, pendingRes, activeRes, pausedRes, closedRes] = await Promise.all([
      admin.from("companies").select("id", { count: "exact", head: true }),
      admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
      admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
      admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "PAUSED"),
      admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "CLOSED"),
    ]);

    if (totalRes.error) console.error("[superadmin.companies.stats] totalRes.error", totalRes.error);
    if (pendingRes.error) console.error("[superadmin.companies.stats] pendingRes.error", pendingRes.error);
    if (activeRes.error) console.error("[superadmin.companies.stats] activeRes.error", activeRes.error);
    if (pausedRes.error) console.error("[superadmin.companies.stats] pausedRes.error", pausedRes.error);
    if (closedRes.error) console.error("[superadmin.companies.stats] closedRes.error", closedRes.error);

    if (totalRes.error || pendingRes.error || activeRes.error || pausedRes.error || closedRes.error) {
      return jsonErr(ctx.rid, "Kunne ikke hente data.", 500, {
        code: "DB_ERROR",
        detail: {
          total: totalRes.error ?? null,
          pending: pendingRes.error ?? null,
          active: activeRes.error ?? null,
          paused: pausedRes.error ?? null,
          closed: closedRes.error ?? null,
        },
      });
    }

    return jsonOk(
      ctx.rid,
      {
        stats: {
          companiesTotal: Number(totalRes.count ?? 0),
          companiesPending: Number(pendingRes.count ?? 0),
          companiesActive: Number(activeRes.count ?? 0),
          companiesPaused: Number(pausedRes.count ?? 0),
          companiesClosed: Number(closedRes.count ?? 0),
        },
      },
      200
    );
  } catch (e: any) {
    return jsonErr(ctx.rid, "Kunne ikke hente data.", 500, { code: "SERVER_ERROR", detail: { message: String(e?.message ?? e) } });
  }
}
