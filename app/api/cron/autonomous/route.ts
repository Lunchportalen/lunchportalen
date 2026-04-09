export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { executeSingularityActions } from "@/lib/ai/automationEngine";
import { detectSaasOpportunities } from "@/lib/ai/autonomousOpportunityEngine";
import { generateAutonomousAction } from "@/lib/ai/autonomousGenerator";
import { getBusinessMetrics } from "@/lib/ai/businessMetrics";
import { recordAutonomousCycle } from "@/lib/ai/memory/recordAutonomous";
import { prioritizeSaasActions } from "@/lib/ai/saasPriorityEngine";
import { analyzeSaas } from "@/lib/ai/saasIntelligenceEngine";
import { buildSaasState } from "@/lib/ai/saasStateEngine";
import { isSystemEnabled } from "@/lib/ai/control/killSwitch";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

const RATE_LIMIT_SEC = 300;
const MAX_ACTIONS_PER_RUN = 2;

function safeTrim(v: unknown) {
  return String(v ?? "").trim();
}

async function secondsSinceLastAutonomousRun(): Promise<number | null> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_memory")
      .select("created_at")
      .eq("kind", "autonomous_cycle")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data || data.created_at == null) return null;
    const t = Date.parse(String(data.created_at));
    if (!Number.isFinite(t)) return null;
    return (Date.now() - t) / 1000;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const requestId = makeRid("autonomous");

    try {
      requireCronAuth(req, { secretEnvVar: "SYSTEM_MOTOR_SECRET", missingCode: "system_motor_secret_missing" });
    } catch (e: unknown) {
      const msg = String((e as { message?: unknown })?.message ?? e);
      const code = String((e as { code?: unknown })?.code ?? "").trim();
      if (msg === "system_motor_secret_missing" || code === "system_motor_secret_missing") {
        return jsonErr(requestId, "SYSTEM_MOTOR_SECRET er ikke satt.", 500, "MISCONFIGURED");
      }
      if (msg === "forbidden" || code === "forbidden") {
        return jsonErr(requestId, "Ugyldig cron-secret.", 403, "FORBIDDEN");
      }
      return jsonErr(requestId, "Cron-gate feilet.", 500, "CRON_AUTH_ERROR");
    }

    if (!isSystemEnabled()) {
      opsLog("ai_cron_kill_switch", { rid: requestId, route: "autonomous" });
      return jsonOk(requestId, { skipped: true, reason: "kill_switch" }, 200);
    }

    if (safeTrim(process.env.AUTONOMOUS_MODE) !== "true") {
      opsLog("autonomous_skipped", { rid: requestId, reason: "AUTONOMOUS_MODE not true" });
      return jsonOk(requestId, { skipped: true, reason: "AUTONOMOUS_MODE is not true" }, 200);
    }

    const elapsed = await secondsSinceLastAutonomousRun();
    if (elapsed != null && elapsed < RATE_LIMIT_SEC) {
      opsLog("autonomous_rate_limited", {
        rid: requestId,
        elapsedSeconds: elapsed,
        minIntervalSeconds: RATE_LIMIT_SEC,
      });
      return jsonOk(
        requestId,
        {
          skipped: true,
          reason: "rate_limited",
          minIntervalSeconds: RATE_LIMIT_SEC,
          elapsedSeconds: elapsed,
        },
        200,
      );
    }

    let metrics;
    try {
      metrics = await getBusinessMetrics();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      opsLog("autonomous_metrics_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "METRICS_FAILED");
    }

    try {
      let state = buildSaasState(metrics);
      try {
        const supabase = supabaseAdmin();
        const { count, error } = await supabase.from("content_pages").select("id", { count: "exact", head: true });
        if (!error && typeof count === "number") {
          state = { ...state, pages: count };
        }
      } catch {
        /* keep pages from buildSaasState */
      }

      const intel = analyzeSaas(state);
      const opportunities = detectSaasOpportunities(state, intel);
      const raw = opportunities.map(generateAutonomousAction);
      const actions = raw.filter((a): a is NonNullable<typeof a> => a != null);
      const prioritized = prioritizeSaasActions(actions, state);
      const toRun = prioritized.slice(0, MAX_ACTIONS_PER_RUN);

      opsLog("autonomous_plan", {
        rid: requestId,
        state,
        intel,
        opportunities,
        prioritized: toRun.map((p) => ({ type: p.type, score: p.score })),
        maxActions: MAX_ACTIONS_PER_RUN,
      });

      const executed =
        toRun.length > 0
          ? await executeSingularityActions(toRun, {
              rid: requestId,
              experimentSource: "autonomous_cron",
            })
          : [];

      const mem = await recordAutonomousCycle({
        rid: requestId,
        state,
        intel,
        opportunities,
        prioritized,
        executed,
      });

      opsLog("autonomous_run", {
        rid: requestId,
        opportunities,
        executed,
        memoryRecorded: mem.ok,
        memoryError: mem.ok ? undefined : mem.message,
      });

      return jsonOk(
        requestId,
        {
          opportunities,
          prioritized: prioritized.map((p) => ({ type: p.type, score: p.score })),
          executed,
          memoryRecorded: mem.ok,
          ...(mem.ok ? {} : { memoryError: mem.message }),
        },
        200,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      opsLog("autonomous_error", { rid: requestId, error: message });
      return jsonOk(requestId, { error: "safe_fail", message }, 200);
    }
  });
}
