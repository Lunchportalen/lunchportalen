export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { executeOrgActions } from "@/lib/ai/automationEngine";
import { getBusinessMetrics } from "@/lib/ai/businessMetrics";
import { recordOrgCycle } from "@/lib/ai/memory/recordOrgCycle";
import { runCEO } from "@/lib/ai/org/ceoAgent";
import { runGrowth } from "@/lib/ai/org/growthAgent";
import { mergeActions } from "@/lib/ai/org/orgCoordinator";
import { buildOrgContext } from "@/lib/ai/org/orgContext";
import { runOperations } from "@/lib/ai/org/operationsAgent";
import { runProduct } from "@/lib/ai/org/productAgent";
import { isSystemEnabled } from "@/lib/ai/control/killSwitch";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

const RATE_LIMIT_SEC = 300;

function safeTrim(v: unknown) {
  return String(v ?? "").trim();
}

async function secondsSinceLastOrgRun(): Promise<number | null> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_memory")
      .select("created_at")
      .eq("kind", "org_cycle")
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
    const requestId = makeRid("org");

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
      opsLog("ai_cron_kill_switch", { rid: requestId, route: "org" });
      return jsonOk(requestId, { skipped: true, reason: "kill_switch" }, 200);
    }

    if (safeTrim(process.env.ORG_MODE_ENABLED) !== "true") {
      opsLog("org_skipped", { rid: requestId, reason: "ORG_MODE_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, reason: "ORG_MODE_ENABLED is not true" }, 200);
    }

    const elapsed = await secondsSinceLastOrgRun();
    if (elapsed != null && elapsed < RATE_LIMIT_SEC) {
      opsLog("org_rate_limited", {
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
      opsLog("org_metrics_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "METRICS_FAILED");
    }

    try {
      const ctx = buildOrgContext(metrics);
      const ceo = runCEO(ctx);
      const growth = runGrowth(ctx, ceo);
      const product = runProduct(ctx);
      const opsActions = runOperations(ctx);
      const merged = mergeActions(growth, product, opsActions);

      opsLog("org_plan", {
        rid: requestId,
        context: ctx,
        ceoDirectives: ceo,
        growthActions: growth,
        productActions: product,
        operationsActions: opsActions,
        mergedActions: merged,
      });

      const executed = merged.length > 0 ? await executeOrgActions(merged, { rid: requestId }) : [];

      const mem = await recordOrgCycle({
        rid: requestId,
        context: ctx,
        ceoDirectives: ceo,
        growthActions: growth,
        productActions: product,
        operationsActions: opsActions,
        mergedActions: merged,
        executed,
      });

      opsLog("org_run", {
        rid: requestId,
        ceoDirectives: ceo,
        growthActions: growth,
        productActions: product,
        operationsActions: opsActions,
        mergedActions: merged,
        executed,
        memoryRecorded: mem.ok,
        memoryError: mem.ok ? undefined : mem.message,
      });

      return jsonOk(
        requestId,
        {
          context: ctx,
          ceoDirectives: ceo,
          growthActions: growth,
          productActions: product,
          operationsActions: opsActions,
          mergedActions: merged,
          executed,
          memoryRecorded: mem.ok,
          ...(mem.ok ? {} : { memoryError: mem.message }),
        },
        200,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      opsLog("org_error", { rid: requestId, error: message });
      return jsonOk(requestId, { error: "safe_fail", message }, 200);
    }
  });
}
