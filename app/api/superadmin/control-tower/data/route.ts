export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";

import { CONTROL_TOWER_CACHE_TAG, getControlTowerData } from "@/lib/controlTower/aggregator";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

/** GET: Control Tower-snapshot (superadmin). ?refresh=1 invaliderer kort cache. */
export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    const rid = gate.ctx.rid || makeRid("control_tower");

    try {
      if (req.nextUrl.searchParams.get("refresh") === "1") {
        revalidateTag(CONTROL_TOWER_CACHE_TAG);
      }
      const data = await getControlTowerData();
      return jsonOk(rid, data, 200);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Control Tower-data feilet.";
      return jsonErr(rid, message, 500, "CONTROL_TOWER_FAILED");
    }
  });
}
