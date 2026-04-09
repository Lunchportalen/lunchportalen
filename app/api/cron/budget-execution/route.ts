/**
 * Turns capital allocation into capped symbolic actions → safe internal execution (draft / experiment / optimize).
 * No payments, no external ad APIs, no unauthenticated HTTP to backoffice routes.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { executeBudgetPlanActions } from "@/lib/ai/automationEngine";
import { allocateCapital } from "@/lib/ai/capital/allocationEngine";
import { buildExecution } from "@/lib/ai/capital/executionEngine";
import { prioritizeExecution } from "@/lib/ai/capital/actionPriority";
import { buildCapitalState } from "@/lib/ai/capital/capitalState";
import { isSystemEnabled } from "@/lib/ai/control/killSwitch";
import { getBusinessMetrics } from "@/lib/ai/businessMetrics";
import { recordBudgetExecution } from "@/lib/ai/memory/recordBudgetExecution";
import { recordResourceAllocation } from "@/lib/ai/memory/recordResourceAllocation";
import { buildExecutionPlan, computeResourceUtilization } from "@/lib/ai/resources/resourceOrchestrator";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";

const MAX_ACTIONS_PER_RUN = 3;

function safeTrim(v: unknown) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const requestId = makeRid("budget_execution");

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
      opsLog("ai_cron_kill_switch", { rid: requestId, route: "budget_execution" });
      return jsonOk(requestId, { skipped: true, reason: "kill_switch" }, 200);
    }

    if (safeTrim(process.env.BUDGET_ENGINE_ENABLED) !== "true") {
      opsLog("budget_execution_skipped", { rid: requestId, reason: "BUDGET_ENGINE_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, reason: "BUDGET_ENGINE_ENABLED is not true" }, 200);
    }

    let metrics;
    try {
      metrics = await getBusinessMetrics();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      opsLog("budget_execution_metrics_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "METRICS_FAILED");
    }

    try {
      const state = buildCapitalState(metrics);
      const allocation = allocateCapital(state);
      const execution = buildExecution(allocation, state);
      const prioritized = prioritizeExecution(execution);
      const flatActions = prioritized.flatMap((p) => p.actions).slice(0, MAX_ACTIONS_PER_RUN);

      opsLog("budget_execution_plan", {
        rid: requestId,
        allocation,
        prioritized,
        flatActions,
      });

      const resourcePlan = buildExecutionPlan(flatActions);
      const utilization = computeResourceUtilization(resourcePlan);
      opsLog("resource_allocation", {
        rid: requestId,
        plan: resourcePlan,
        utilization,
      });

      const actionsToRun = resourcePlan.map((p) => p.action);
      const executed =
        actionsToRun.length > 0 ? await executeBudgetPlanActions(actionsToRun, { rid: requestId }) : [];

      const mem = await recordBudgetExecution({
        rid: requestId,
        allocation,
        prioritizedPlan: prioritized,
        flatActions,
        executed,
      });

      const memRes = await recordResourceAllocation({
        rid: requestId,
        requestedActions: flatActions,
        plan: resourcePlan,
        utilization,
      });

      opsLog("budget_execution_run", {
        rid: requestId,
        allocation,
        resourcePlan,
        utilization,
        executed,
        memoryRecorded: mem.ok,
        memoryError: mem.ok ? undefined : mem.message,
        resourceMemoryRecorded: memRes.ok,
        resourceMemoryError: memRes.ok ? undefined : memRes.message,
      });

      return jsonOk(
        requestId,
        {
          allocation,
          prioritized,
          flatActions,
          resourcePlan,
          utilization,
          executed,
          memoryRecorded: mem.ok,
          resourceMemoryRecorded: memRes.ok,
          ...(mem.ok ? {} : { memoryError: mem.message }),
          ...(memRes.ok ? {} : { resourceMemoryError: memRes.message }),
        },
        200,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      opsLog("budget_execution_error", { rid: requestId, error: message });
      return jsonOk(requestId, { error: "safe_fail", message }, 200);
    }
  });
}
