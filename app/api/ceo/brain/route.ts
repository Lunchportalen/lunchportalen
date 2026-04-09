export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// CONTROL_TOWER_SOURCE

import type { NextRequest } from "next/server";

import { buildCeoSnapshotData } from "@/lib/ceo/buildSnapshot";
import { logCEO } from "@/lib/ceo/log";
import { getTopPriorities } from "@/lib/ceo/priorities";
import { getStrategy } from "@/lib/ceo/strategy";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

/** GET: snapshot + prioriteter + strategi (kun forslag — ingen auto-utførelse eller DB-skriv). */
export async function GET(req: NextRequest): Promise<Response> {
  const rid = makeRid("ceo_brain");
  try {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    const built = await buildCeoSnapshotData();
    if (built.ok === false) {
      const code = built.code ?? "CEO_BRAIN_FAILED";
      const status = built.code === "CONFIG_ERROR" ? 503 : 200;
      logCEO({
        rid,
        event: "ceo_brain_failed",
        error: built.error,
        code: built.code ?? null,
      });
      return jsonErr(rid, built.error, status, code);
    }

    const snapshot = built.snapshot;
    const priorities = getTopPriorities(snapshot);
    const strategy = getStrategy(snapshot);

    logCEO({
      rid,
      event: "ceo_brain",
      revenue: snapshot.revenue,
      leads: snapshot.leads,
      forecast: snapshot.forecast,
      priorityCount: priorities.length,
      strategyCount: strategy.length,
    });

    return jsonOk(rid, { snapshot, priorities, strategy }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logCEO({ rid, event: "ceo_brain_exception", error: message });
    return jsonErr(rid, "CEO snapshot midlertidig utilgjengelig.", 500, "CEO_BRAIN_UNHANDLED");
  }
}
