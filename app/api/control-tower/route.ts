export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { executeControlAction } from "@/lib/ai/controlTower/controlExecutor";
import { isRegisteredControlAction } from "@/lib/ai/controlTower/actionRegistry";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const rid = gate.ctx.rid;
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
    }
    const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    const action = safeStr(o?.action);
    if (!action) {
      opsLog("control_tower_run", { rid, ok: false, phase: "validation", reason: "missing_action" });
      return jsonErr(rid, "Mangler action.", 400, "VALIDATION_ERROR");
    }

    if (!isRegisteredControlAction(action)) {
      opsLog("control_tower_run", { rid, ok: false, phase: "validation", reason: "unregistered_action", action });
      return jsonErr(rid, "Ukjent control action.", 422, "VALIDATION_ERROR");
    }

    const result = await executeControlAction(action);
    opsLog("control_tower_run", {
      rid,
      ok: result.ok,
      action: result.action,
      phase: "complete",
      httpStatus: result.httpStatus,
      path: result.path,
    });

    return jsonOk(rid, result, 200);
  });
}
