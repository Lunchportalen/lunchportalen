export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getControlTowerData } from "@/lib/controlTower/aggregator";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

/** Alias for integrations — same payload as `GET /api/superadmin/control-tower/data`. */
export async function buildControlTowerState() {
  return getControlTowerData();
}

/**
 * GET: Control Tower snapshot (superadmin). Additive route — identical to `/control-tower/data`.
 */
export async function GET(_req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(_req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("control_tower_root");

  try {
    const data = await buildControlTowerState();
    return jsonOk(rid, data, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Control Tower-data feilet.";
    return jsonErr(rid, message, 500, "CONTROL_TOWER_FAILED");
  }
}
