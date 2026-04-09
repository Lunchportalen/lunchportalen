export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getSystemSnapshotPayload } from "@/lib/observability/systemSnapshot";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";

export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const rid = gate.ctx.rid;
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    try {
      const snapshot = await getSystemSnapshotPayload();
      opsLog("control_tower_snapshot_served", { rid, healthStatus: snapshot.health.status });
      return jsonOk(rid, snapshot, 200);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      opsLog("control_tower_snapshot_failed", { rid, message });
      return jsonErr(rid, message, 500, "SNAPSHOT_FAILED");
    }
  });
}
