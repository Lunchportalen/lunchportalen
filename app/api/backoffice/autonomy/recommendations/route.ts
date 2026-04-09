export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getRecommendations } from "@/lib/ai/recommendations";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, "api.backoffice.autonomy.recommendations.GET", ["superadmin"]);
    if (deny) return deny;

    try {
      const data = await getRecommendations();
      return jsonOk(gate.ctx.rid, { recommendations: data }, 200);
    } catch (e) {
      return jsonErr(
        gate.ctx.rid,
        "Kunne ikke hente anbefalinger.",
        500,
        "RECOMMENDATIONS_FAILED",
        e
      );
    }
  });
}
