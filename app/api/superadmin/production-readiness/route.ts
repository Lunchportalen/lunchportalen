export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, denyResponse } from "@/lib/http/routeGuard";
import { osloTodayISODate } from "@/lib/date/oslo";
import { loadProductionReadiness } from "@/lib/server/superadmin/loadProductionReadiness";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function GET(req: NextRequest) {
  const s = await scopeOr401(req);
  if (!s.ok) return denyResponse(s);

  const deny = requireRoleOr403(s.ctx, "api.superadmin.production_readiness.GET", ["superadmin"]);
  if (deny) return deny;

  const rid = s.ctx.rid;
  const u = new URL(req.url);
  const date = safeStr(u.searchParams.get("date")) || osloTodayISODate();

  try {
    const data = await loadProductionReadiness(date);
    return jsonOk(rid, data, 200);
  } catch (e: unknown) {
    return jsonErr(rid, "Kunne ikke beregne produksjonssjekk.", 500, "PRODUCTION_READINESS_FAILED", {
      detail: safeStr(e instanceof Error ? e.message : e),
    });
  }
}
