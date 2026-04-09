export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { updateLeadProbabilities } from "@/lib/pipeline/applyProbability";
import { runPredictionEngine } from "@/lib/pipeline/runPrediction";
import { runRevenueAutopilot } from "@/lib/revenue/runRevenueAutopilot";
import { runSalesLoop } from "@/lib/sales/loop";
import { runSequenceEngine } from "@/lib/sales/runSequence";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

/**
 * Periodisk: recompute empiriske meta.probability per pipeline_stage (won/lost-basert).
 * Krever CRON_SECRET; feiler aldri med 500 på tom DB — se body.ok.
 */
export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
    const rid = makeRid("cron_pipeline_prob");

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

    const probResult = await updateLeadProbabilities();
    const predResult = await runPredictionEngine();
    const loopResult = await runSalesLoop(rid);
    const sequenceResult = await runSequenceEngine(rid);
    const revenueResult = await runRevenueAutopilot(rid);

    return jsonOk(
      rid,
      {
        ok:
          probResult.ok &&
          predResult.ok &&
          loopResult.ok &&
          sequenceResult.ok &&
          revenueResult.ok,
        /** Bakoverkompatibel: empirisk sannsynlighet-jobb */
        processed: probResult.processed,
        skippedManual: probResult.skippedManual,
        skippedNoChange: probResult.skippedNoChange,
        stats: probResult.stats ?? null,
        error: probResult.error ?? null,
        probabilities: {
          ok: probResult.ok,
          processed: probResult.processed,
          skippedManual: probResult.skippedManual,
          skippedNoChange: probResult.skippedNoChange,
          stats: probResult.stats ?? null,
          error: probResult.error ?? null,
        },
        prediction: {
          ok: predResult.ok,
          processed: predResult.processed,
          skippedTerminal: predResult.skippedTerminal,
          skippedLocked: predResult.skippedLocked,
          error: predResult.error ?? null,
        },
        salesLoop: {
          ok: loopResult.ok,
          dryRun: loopResult.dryRun,
          actionsSuggested: loopResult.actions.length,
          readyToCloseCount: loopResult.readyToCloseCount,
          error: loopResult.error ?? null,
        },
        sequence: {
          ok: sequenceResult.ok,
          dryRun: sequenceResult.dryRun,
          drafts: sequenceResult.drafts.length,
          skippedDailyCap: sequenceResult.skippedDailyCap,
          error: sequenceResult.error ?? null,
        },
        revenue: {
          ok: revenueResult.ok,
          posts: revenueResult.posts,
          orders: revenueResult.orders,
          leads: revenueResult.leads,
          winners: revenueResult.winners,
          losers: revenueResult.losers,
          actions: revenueResult.actions.length,
          topRevenueSum: revenueResult.topRevenueSum,
          error: revenueResult.error ?? null,
        },
      },
      200,
    );
  });
}
