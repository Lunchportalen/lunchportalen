export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { findBuyers } from "@/lib/acquire/buyers";
import { findTargets } from "@/lib/acquire/targets";
import { auditLog } from "@/lib/core/audit";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { opsLog } from "@/lib/ops/log";

/**
 * GET: statiske illustrasjonslister (ingen AI). Strategi genereres via POST /api/acquire/strategy.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.acquire.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const targets = findTargets();
    const buyers = findBuyers();
    opsLog("api_acquire_GET", { rid: gate.ctx.rid, targets: targets.length, buyers: buyers.length });
    await auditLog({
      action: "acquire_lists_view",
      entity: "acquire",
      metadata: { rid: gate.ctx.rid },
    });
    return jsonOk(gate.ctx.rid, { targets, buyers }, 200);
  } catch (e) {
    return jsonErr(gate.ctx.rid, "Kunne ikke hente Acquire-lister.", 500, "ACQUIRE_LISTS_FAILED", e);
  }
}
