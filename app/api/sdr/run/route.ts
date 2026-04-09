export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runSDR } from "@/lib/sdr/run";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

/**
 * POST: run queued SDR generation (superadmin). GET is not supported — avoids accidental crawlers.
 */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, "api.sdr.run.POST", ["superadmin"]);
    if (deny) return deny;

    try {
      const results = await runSDR();
      return jsonOk(gate.ctx.rid, { results, count: results.length }, 200);
    } catch (e) {
      return jsonErr(gate.ctx.rid, "SDR-kjøring feilet.", 500, "SDR_RUN_FAILED", e);
    }
  });
}
