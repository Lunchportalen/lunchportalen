export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { collectAutopilotMetrics } from "@/lib/autopilot/collectMetrics";
import { getControlTowerData } from "@/lib/controlTower/aggregator";
import { countRunningCmsExperiments } from "@/lib/investor/experimentsCount";
import { buildInvestorSnapshot } from "@/lib/investor/snapshot";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

export async function GET(_req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(_req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("investor_snapshot");

  try {
    const [controlTower, autopilotMetrics, experimentsRunning] = await Promise.all([
      getControlTowerData(),
      collectAutopilotMetrics(),
      countRunningCmsExperiments(),
    ]);

    const data = buildInvestorSnapshot({
      controlTower,
      autopilotMetrics,
      experimentsRunning,
    });

    return jsonOk(rid, data, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, msg, 500, "INVESTOR_SNAPSHOT_FAILED");
  }
}
