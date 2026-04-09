import type { NextRequest } from "next/server";

import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET(request: NextRequest) {
  return withApiAiEntrypoint(request, "GET", async () => {
    const s = await scopeOr401(request);
    if (!s?.ok) return denyResponse(s);
    const ctx = s.ctx;
    const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
    if (roleDeny) return roleDeny;

    let supabase;
    try {
      supabase = supabaseAdmin();
    } catch {
      return jsonErr(ctx.rid, "Tjenesten er ikke konfigurert.", 500, "MISCONFIGURED");
    }

    const experimentsP = supabase.from("experiments").select("*");
    const revenueP = supabase.from("experiment_revenue").select("*");
    const sessionsP = supabase.from("experiment_sessions").select("*");

    const [expRes, revRes, sessRes] = await Promise.all([experimentsP, revenueP, sessionsP]);

    if (expRes.error) {
      return jsonErr(ctx.rid, expRes.error.message, 500, "DB_ERROR");
    }
    if (revRes.error) {
      return jsonErr(ctx.rid, revRes.error.message, 500, "DB_ERROR");
    }
    if (sessRes.error) {
      return jsonErr(ctx.rid, sessRes.error.message, 500, "DB_ERROR");
    }

    return jsonOk(
      ctx.rid,
      {
        experiments: expRes.data ?? [],
        revenue: revRes.data ?? [],
        sessions: sessRes.data ?? [],
      },
      200,
    );
  });
}
