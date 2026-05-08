export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { logAiExecution } from "@/lib/ai/logging/aiExecutionLog";
import type { AutopilotLoopResult } from "@/lib/autopilot/engine";
import { getLastAutopilotLoopRun } from "@/lib/autopilot/engine";
import { getRunningExperimentsSnapshot } from "@/lib/autopilot/experiment";
import {
  getAutopilotKillSwitchState,
  setAutopilotRuntimeOverride,
} from "@/lib/autopilot/kill-switch";
import { syncAutopilotRuntimeFromSystemSettings } from "@/lib/autopilot/settings-sync";
import { writeAuditEvent } from "@/lib/audit/write";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

    const sync = await syncAutopilotRuntimeFromSystemSettings();
    if ("message" in sync) {
      return jsonErr(rid, sync.message, 500, "DB_ERROR");
    }

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
    const admin = supabaseAdmin();
    const previousState = getAutopilotKillSwitchState();
    const persistedBefore = await syncAutopilotRuntimeFromSystemSettings(admin);
    if ("message" in persistedBefore) {
      return jsonErr(rid, persistedBefore.message, 500, "DB_ERROR");
    }

    const nextEnabled = action === "enable";
    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("system_settings")
      .update({
        autopilot_enabled: nextEnabled,
        updated_at: now,
        updated_by: userId,
      } as any)
      .eq("id", persistedBefore.rowId);

    if (updateError) {
      return jsonErr(rid, "Kunne ikke lagre autopilot-tilstand.", 500, "DB_ERROR");
    }

    setAutopilotRuntimeOverride(nextEnabled);
    const newState = getAutopilotKillSwitchState();

    void logAiExecution({
      capability: "control_tower_autopilot_kill_switch",
      resultStatus: "success",
      userId,
      metadata: {
        domain: "control_tower",
        action,
        previousState,
        stateAfter: newState,
        persisted: { table: "system_settings", id: persistedBefore.rowId, autopilot_enabled: nextEnabled },
        note: "Autopilot-tilstand persistert i system_settings og synkronisert til runtime.",
      },
    });

    void writeAuditEvent({
      scope: {
        role: gate.ctx.scope.role,
        user_id: userId,
        email: gate.ctx.scope.email,
      },
      action: "autopilot_toggled",
      entity_type: "system_settings",
      entity_id: persistedBefore.rowId,
      summary: `Autopilot ${nextEnabled ? "aktivert" : "deaktivert"}`,
      detail: {
        action,
        previous_state: previousState,
        new_state: newState,
        updated_at: now,
      },
    });

    const ks = newState;
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
