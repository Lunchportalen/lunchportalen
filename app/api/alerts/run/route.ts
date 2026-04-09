export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";

import { CONTROL_TOWER_CACHE_TAG, getControlTowerData } from "@/lib/controlTower/aggregator";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

/**
 * POST: kjør kontrolltårn-aggregat på nytt (oppfrisker cache) og returner finansvarsler.
 * Samme pipeline som Control Tower: runAlertChecks + dispatch (kjøling + logg).
 */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    const rid = gate.ctx.rid || makeRid("alerts_run");

    try {
      revalidateTag(CONTROL_TOWER_CACHE_TAG);
      const data = await getControlTowerData();
      return jsonOk(
        rid,
        {
          financialAlerts: data.financialAlerts,
          generatedAt: data.generatedAt,
        },
        200,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Kjøring av varsler feilet.";
      return jsonErr(rid, message, 500, "ALERTS_RUN_FAILED");
    }
  });
}
