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

    const [total, pending, active, paused, closed] = await Promise.all([
      admin.from("companies").select("id", { count: "exact", head: true }),
      admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "active"),
      admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "paused"),
      admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "closed"),
    ]);

    if (total.error) return jsonErr(ctx.rid, "Kunne ikke hente stats.", 500, { code: "DB_ERROR", detail: total.error });
    if (pending.error) return jsonErr(ctx.rid, "Kunne ikke hente stats.", 500, { code: "DB_ERROR", detail: pending.error });
    if (active.error) return jsonErr(ctx.rid, "Kunne ikke hente stats.", 500, { code: "DB_ERROR", detail: active.error });
    if (paused.error) return jsonErr(ctx.rid, "Kunne ikke hente stats.", 500, { code: "DB_ERROR", detail: paused.error });
    if (closed.error) return jsonErr(ctx.rid, "Kunne ikke hente stats.", 500, { code: "DB_ERROR", detail: closed.error });

    return jsonOk(ctx.rid, {
        ok: true,
        rid: ctx.rid,
        stats: {
          companiesTotal: Number(total.count ?? 0),
          companiesPending: Number(pending.count ?? 0),
          companiesActive: Number(active.count ?? 0),
          companiesPaused: Number(paused.count ?? 0),
          companiesClosed: Number(closed.count ?? 0),
        },
      }, 200);
  } catch (e: any) {
    return jsonErr(ctx.rid, "Kunne ikke hente stats.", 500, { code: "SERVER_ERROR", detail: { message: String(e?.message ?? e) } });
  }
}


