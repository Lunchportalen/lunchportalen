export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { evaluateSystem } from "@/lib/ai/ceo/decisionEngine";
import { generateGrowthActions } from "@/lib/ai/ceo/growthEngine";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

/** GET: current CEO recommendations (read-only, no cycle side effects beyond evaluate). */
export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = ctx.rid || makeRid("ceo_rec");

  try {
    const { decisions, snapshot } = await evaluateSystem({ rid });
    const actions = generateGrowthActions(decisions).slice(0, 3);
    return jsonOk(rid, { snapshot, decisions, actions }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Kunne ikke beregne anbefalinger.";
    return jsonErr(rid, message, 500, "CEO_RECOMMENDATIONS_FAILED");
  }
  });
}
