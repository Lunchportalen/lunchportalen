export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { buildCeoSnapshotData } from "@/lib/ceo/buildSnapshot";
import { logCEO } from "@/lib/ceo/log";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

/** GET: globalt business snapshot — samme logikk som revenue brain + social AI + autopilot (kun lesing). */
export async function GET(req: NextRequest): Promise<Response> {
  const rid = makeRid("ceo_snapshot");
  try {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    const built = await buildCeoSnapshotData();
    if (built.ok === false) {
      const status = built.code === "CONFIG_ERROR" ? 503 : 500;
      logCEO({
        rid,
        event: "ceo_snapshot_failed",
        error: built.error,
        code: built.code ?? null,
      });
      return jsonErr(rid, built.error, status, built.code ?? "CEO_SNAPSHOT_FAILED");
    }

    logCEO({
      rid,
      event: "ceo_snapshot",
      revenue: built.snapshot.revenue,
      leads: built.snapshot.leads,
      forecast: built.snapshot.forecast,
      actionCount: built.snapshot.actions.length,
    });

    return jsonOk(rid, built.snapshot, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logCEO({ rid, event: "ceo_snapshot_exception", error: message });
    return jsonErr(rid, message, 500, "CEO_SNAPSHOT_UNHANDLED");
  }
}
