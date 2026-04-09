export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getRevenueAttribution } from "@/lib/revenue/aiRevenueAttribution";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withTimeout } from "@/lib/core/timeout";

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.revenue.live.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const attribution = await withTimeout(getRevenueAttribution(), 12_000);
    let total = 0;
    for (const k of Object.keys(attribution)) {
      const v = attribution[k];
      total += typeof v === "number" && Number.isFinite(v) ? v : 0;
    }
    return jsonOk(gate.ctx.rid, { attribution, total }, 200);
  } catch (e) {
    if (e instanceof Error && e.message === "TIMEOUT") {
      return jsonErr(gate.ctx.rid, "Revenue live tok for lang tid.", 504, "REVENUE_LIVE_TIMEOUT", e);
    }
    return jsonErr(gate.ctx.rid, "Kunne ikke hente live revenue.", 500, "REVENUE_LIVE_FAILED", e);
  }
}
