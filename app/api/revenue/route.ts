export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { layeredGet, layeredSet } from "@/lib/cache/layeredCache";
import { withTimeout } from "@/lib/core/timeout";
import { getAiRevenueForecast } from "@/lib/revenue/aiRevenueForecast";
import { getRevenueAttribution } from "@/lib/revenue/aiRevenueAttribution";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.revenue.engine.GET", ["superadmin"]);
  if (deny) return deny;

  const url = new URL(req.url);
  const noCache = url.searchParams.get("noCache") === "1";
  const perf = process.env.DEBUG_API_PERF === "1";
  const cacheKey = "revenue:engine:v1";

  try {
    if (perf) console.time(`revenue_engine:${gate.ctx.rid}`);
    if (!noCache) {
      const hit = await layeredGet<{ attribution: unknown; forecast: unknown }>(cacheKey);
      if (hit) {
        return jsonOk(gate.ctx.rid, { ...hit, _cached: true }, 200);
      }
    }
    const [attribution, forecast] = await Promise.all([
      withTimeout(getRevenueAttribution(), 12_000),
      withTimeout(getAiRevenueForecast(), 12_000),
    ]);
    const body = { attribution, forecast };
    await layeredSet(cacheKey, body, 12_000);
    return jsonOk(gate.ctx.rid, body, 200);
  } catch (e) {
    if (e instanceof Error && e.message === "TIMEOUT") {
      return jsonErr(gate.ctx.rid, "Revenue-motor tok for lang tid (timeout).", 504, "REVENUE_TIMEOUT", e);
    }
    return jsonErr(gate.ctx.rid, "Kunne ikke hente revenue-motor.", 500, "REVENUE_ENGINE_FAILED", e);
  } finally {
    if (perf) console.timeEnd(`revenue_engine:${gate.ctx.rid}`);
  }
}
