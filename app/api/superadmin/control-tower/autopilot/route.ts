export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { logAiExecution } from "@/lib/ai/logging/aiExecutionLog";
import type { AutopilotLoopResult } from "@/lib/autopilot/engine";
import { getLastAutopilotLoopRun } from "@/lib/autopilot/engine";
import { getRunningExperimentsSnapshot } from "@/lib/autopilot/experiment";
import {
  disableAutopilot,
  enableAutopilot,
  getAutopilotKillSwitchState,
} from "@/lib/autopilot/kill-switch";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

function summaryNbLoop(r: AutopilotLoopResult): string {
  switch (r.status) {
    case "disabled":
      return "Hoppet over (kill-switch)";
    case "skipped":
      return r.reason === "rate_limit_1h"
        ? "Hoppet over (maks én gang per time)"
        : "Hoppet over (aktivt eksperiment)";
    case "idle":
      return "Ingen mulighet (ingen treff)";
    case "created":
      return `Eksperiment startet: ${r.experiment.id}`;
    case "error":
      return r.message;
  }
}

/** GET: autopilot kill-switch + in-memory experiment / last loop (superadmin). POST: enable / pause (runtime override). */
export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    const rid = gate.ctx.rid || makeRid("ct_autopilot");

    const ks = getAutopilotKillSwitchState();
    const running = getRunningExperimentsSnapshot();
    const primary = running[0] ?? null;
    const last = getLastAutopilotLoopRun();

    return jsonOk(
      rid,
      {
        enabled: ks.effectiveEnabled,
        envAllows: ks.envAllows,
        runtimeOverride: ks.runtimeOverride,
        currentExperiment: primary
          ? {
              id: primary.id,
              type: primary.type,
              target: primary.target,
              status: primary.status,
              startedAt: primary.startedAt,
            }
          : null,
        lastResult: last
          ? {
              atIso: new Date(last.at).toISOString(),
              status: last.result.status,
              summary: summaryNbLoop(last.result),
            }
          : null,
      },
      200,
    );
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    const rid = gate.ctx.rid || makeRid("ct_autopilot");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
    }
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    const action = o?.action != null ? String(o.action).trim().toLowerCase() : "";
    if (action !== "enable" && action !== "disable") {
      return jsonErr(rid, "action må være enable eller disable.", 400, "BAD_REQUEST");
    }

    const userId = gate.ctx.scope.userId ?? null;

    if (action === "enable") {
      enableAutopilot();
    } else {
      disableAutopilot();
    }

    void logAiExecution({
      capability: "control_tower_autopilot_kill_switch",
      resultStatus: "success",
      userId,
      metadata: {
        domain: "control_tower",
        action,
        stateAfter: getAutopilotKillSwitchState(),
        note: "Runtime override i prosess — ikke persistert som env. Ingen auto-deploy.",
      },
    });

    const ks = getAutopilotKillSwitchState();
    return jsonOk(
      rid,
      {
        enabled: ks.effectiveEnabled,
        envAllows: ks.envAllows,
        runtimeOverride: ks.runtimeOverride,
      },
      200,
    );
  });
}
