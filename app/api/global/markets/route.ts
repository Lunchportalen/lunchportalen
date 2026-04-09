export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { GLOBAL_SCALING } from "@/lib/global/scaling";
import { MARKETS } from "@/lib/global/markets";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

/** GET: markedsliste + tak (superadmin). */
export async function GET(_req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(_req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("global_markets");
  return jsonOk(rid, { markets: MARKETS, scaling: GLOBAL_SCALING }, 200);
}
