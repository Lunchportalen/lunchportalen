import "server-only";

import type { NextRequest } from "next/server";

import { jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

/**
 * Source of truth for superadmin Control Tower GET routes:
 * scope → role → rid → jsonOk(rid, data, 200).
 * Error paths use routeGuard helpers (jsonErr inside denyResponse / requireRoleOr403).
 */
export async function superadminControlTowerJsonGet<T extends Record<string, unknown>>(
  req: NextRequest,
  ridPrefix: string,
  build: (args: { rid: string }) => Promise<T> | T,
): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;
    const rid = gate.ctx.rid || makeRid(ridPrefix);
    const data = await build({ rid });
    return jsonOk(rid, data, 200);
  });
}
