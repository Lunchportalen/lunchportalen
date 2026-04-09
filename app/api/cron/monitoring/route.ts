export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { runMonitoring } from "@/lib/monitoring/run";
import { opsLog } from "@/lib/ops/log";
import { runSelfHealing } from "@/lib/selfheal/run";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

/**
 * Periodic anomaly check (baseline vs current from /api/observability graph metrics + DB aggregates).
 * Auth: CRON_SECRET (Authorization: Bearer eller x-cron-secret).
 */
export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
    const rid = makeRid("cron_monitoring");

    try {
      requireCronAuth(req);
    } catch (e: unknown) {
      const msg = String((e as { message?: unknown })?.message ?? e);
      const code = String((e as { code?: unknown })?.code ?? "").trim();
      if (msg === "cron_secret_missing" || code === "cron_secret_missing") {
        return jsonErr(rid, "CRON_SECRET er ikke satt.", 500, "MISCONFIGURED");
      }
      if (msg === "forbidden" || code === "forbidden") {
        return jsonErr(rid, "Ugyldig cron-secret.", 403, "FORBIDDEN");
      }
      return jsonErr(rid, "Cron-gate feilet.", 500, "CRON_AUTH_ERROR");
    }

    try {
      const out = await runMonitoring();
      if (out.ok === false) {
        opsLog("cron_monitoring_skip", { rid, reason: out.reason });
        return jsonOk(rid, { ok: false, reason: out.reason, runRid: out.rid }, 200);
      }

      let selfHeal: Awaited<ReturnType<typeof runSelfHealing>> | null = null;
      try {
        selfHeal = await runSelfHealing(out.anomalies, {
          monitoringRid: out.rid,
          before: out.current,
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        opsLog("cron_self_heal_failed", { rid, message, monitoringRid: out.rid });
        selfHeal = { ok: false, reason: message };
      }

      return jsonOk(
        rid,
        {
          ok: true,
          runRid: out.rid,
          anomalyCount: out.anomalies.length,
          anomalies: out.anomalies,
          results: out.results,
          selfHeal,
        },
        200
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      opsLog("cron_monitoring_failed", { rid, message });
      return jsonErr(rid, message, 500, "MONITORING_FAILED");
    }
  });
}
