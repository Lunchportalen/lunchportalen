export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runRevenueAutopilot } from "@/lib/revenue/runRevenueAutopilot";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

/**
 * Leser data og bygger autopilot-forslag (ingen sideeffekter utenom valgfri cache i getRevenueHooks).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("revenue_autopilot");

  const result = await runRevenueAutopilot(rid, { skipLog: true });

  if (!result.ok) {
    return jsonErr(rid, result.error ?? "Revenue autopilot feilet.", 503, "REVENUE_AUTOPILOT_FAILED");
  }

  return jsonOk(
    rid,
    {
      summary: {
        posts: result.posts,
        orders: result.orders,
        leads: result.leads,
        winners: result.winners,
        losers: result.losers,
        topRevenueSum: result.topRevenueSum,
      },
      topPerformingPosts: result.topPerformingPosts,
      worstPerformingPosts: result.worstPerformingPosts,
      actions: result.actions,
      projectedImpactNote:
        "«Projeksjon» = sum attribuert omsetning på topp 3 innlegg (historisk, ikke prognose).",
    },
    200,
  );
}
