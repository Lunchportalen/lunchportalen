export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runCapitalAllocation } from "@/lib/growth/capitalAllocation/runCapitalAllocation";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

/**
 * POST: deterministisk kapital-/trafikkallokering per marked (kanalvekter), med guard + audit-logg.
 * Ingen skjem/endringer — tilstand i `ai_activity_log` (`allocation_update`).
 */
export async function POST(_req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(_req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("capital_allocate");

  try {
    const data = await runCapitalAllocation(rid);
    return jsonOk(
      rid,
      {
        allocationChanges: data.allocationChanges,
        bestChannelsPerMarket: data.bestChannelsPerMarket,
        nextExperimentFocus: data.nextExperimentFocus,
        globalTransferSuggestions: data.globalTransferSuggestions,
        experimentWinner: data.experimentWinner,
        markets: data.markets,
      },
      200,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, msg, 500, "CAPITAL_ALLOCATION_FAILED");
  }
}
