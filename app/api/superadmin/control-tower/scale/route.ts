export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { logAiExecution } from "@/lib/ai/logging/aiExecutionLog";
import { getLastBudgetSnapshot } from "@/lib/scale/budget";
import {
  clearScaleModeRuntimeOverride,
  disableScaleModeRuntime,
  enableScaleModeRuntime,
  getScaleModeState,
  pauseScaleMode,
  resumeScaleMode,
  setScaleManualOverride,
} from "@/lib/scale/controlState";
import { loadTrackedChannels, pickBestChannel } from "@/lib/scale/channels";
import { DEFAULT_MARKETS, getMarketPerformance } from "@/lib/scale/markets";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

/** GET: scale-modus + markeder + budsjettfordeling + toppkanal. POST: enable/pause/manuell. */
export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    const rid = gate.ctx.rid || makeRid("ct_scale");

    const mode = getScaleModeState();
    const budgetPerMarket = getLastBudgetSnapshot();

    const marketRows = await Promise.all(
      DEFAULT_MARKETS.map(async (m) => {
        const perf = await getMarketPerformance(m.id);
        if (perf.ok === false) {
          return {
            id: m.id,
            name: m.name,
            country: m.country,
            currency: m.currency,
            active: m.active,
            performance: m.performance,
            loadError: perf.error,
          };
        }
        return {
          id: m.id,
          name: m.name,
          country: m.country,
          currency: m.currency,
          active: m.active,
          performance: perf.performance,
          loadError: null as string | null,
        };
      }),
    );

    const ch = await loadTrackedChannels();
    const top =
      ch.ok === true
        ? pickBestChannel(ch.channels)
        : { best: null as string | null, scores: {} as Record<string, number>, explain: [] as string[] };

    return jsonOk(
      rid,
      {
        enabled: mode.runtimeOverride !== null ? mode.runtimeOverride : mode.envAllows,
        paused: mode.paused,
        manualOverride: mode.manualOverride,
        envAllows: mode.envAllows,
        runtimeOverride: mode.runtimeOverride,
        effectiveActive: mode.effectiveActive,
        budgetPerMarket,
        markets: marketRows,
        topChannel: {
          id: top.best,
          label:
            top.best === "facebook"
              ? "Facebook"
              : top.best === "instagram"
                ? "Instagram"
                : top.best === "tiktok"
                  ? "TikTok"
                  : top.best === "email"
                    ? "E-post"
                    : "—",
        },
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

    const rid = gate.ctx.rid || makeRid("ct_scale");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
    }
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    const action = o?.action != null ? String(o.action).trim().toLowerCase() : "";

    const userId = gate.ctx.scope.userId ?? null;

    switch (action) {
      case "enable":
        enableScaleModeRuntime();
        break;
      case "disable":
        disableScaleModeRuntime();
        break;
      case "clear_override":
        clearScaleModeRuntimeOverride();
        break;
      case "pause":
        pauseScaleMode();
        break;
      case "resume":
        resumeScaleMode();
        break;
      case "manual_on":
        setScaleManualOverride(true);
        break;
      case "manual_off":
        setScaleManualOverride(false);
        break;
      default:
        return jsonErr(
          rid,
          "action må være enable, disable, clear_override, pause, resume, manual_on eller manual_off.",
          400,
          "BAD_REQUEST",
        );
    }

    void logAiExecution({
      capability: "control_tower_scale_mode",
      resultStatus: "success",
      userId,
      metadata: {
        domain: "control_tower",
        action,
        stateAfter: getScaleModeState(),
        note: "Runtime i prosess — ikke persistert som env. Manuell overstyring er en flagg for drift.",
      },
    });

    const mode = getScaleModeState();
    return jsonOk(
      rid,
      {
        enabled: mode.runtimeOverride !== null ? mode.runtimeOverride : mode.envAllows,
        paused: mode.paused,
        manualOverride: mode.manualOverride,
        envAllows: mode.envAllows,
        runtimeOverride: mode.runtimeOverride,
        effectiveActive: mode.effectiveActive,
      },
      200,
    );
  });
}
