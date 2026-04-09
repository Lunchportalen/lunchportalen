export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { generateOptimizations } from "@/lib/ai/optimize";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, "api.backoffice.autonomy.optimize.GET", ["superadmin"]);
    if (deny) return deny;

    try {
      const data = await generateOptimizations();
      return jsonOk(gate.ctx.rid, { suggestions: data }, 200);
    } catch (e) {
      return jsonErr(
        gate.ctx.rid,
        "Kunne ikke generere optimaliseringsforslag.",
        500,
        "OPTIMIZE_FAILED",
        e
      );
    }
  });
}
