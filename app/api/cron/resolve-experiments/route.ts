export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Cron: resolves running CMS traffic experiments.
 *
 * - **Default (legacy):** {@link pickWinner} per experiment, then `applyProd: true` (same contract as
 *   `POST /api/backoffice/experiments/resolve`).
 * - **MOO (opt-in):** set `LP_EXPERIMENT_RESOLVE_MODE=moo` — at most one running experiment per run; uses
 *   `lib/moo` (real metrics, Pareto guard, `ai_activity_log` `moo_decision`). Does not change default behavior when unset.
 */

import type { NextRequest } from "next/server";

import { EXPERIMENT_MIN_IMPRESSIONS_FOR_WINNER, pickWinner } from "@/lib/ai/experimentWinnerDecision";
import { withCmsPageDocumentGate } from "@/lib/cms/cmsPageDocumentGate";
import { applyExperimentWinnerToCms } from "@/lib/experiments/applyWinnerToCms";
import { validateWinnerAppliedToProd } from "@/lib/experiments/validateWinnerAppliedToProd";
import { runMooResolveBatch } from "@/lib/moo/runMooResolve";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const rid = makeRid("cron_exp");

    try {
      requireCronAuth(req, { secretEnvVar: "SYSTEM_MOTOR_SECRET", missingCode: "system_motor_secret_missing" });
    } catch (e: unknown) {
      const msg = String((e as { message?: unknown })?.message ?? e);
      const code = String((e as { code?: unknown })?.code ?? "").trim();
      if (msg === "system_motor_secret_missing" || code === "system_motor_secret_missing") {
        return jsonErr(rid, "SYSTEM_MOTOR_SECRET er ikke satt.", 500, "MISCONFIGURED");
      }
      if (msg === "forbidden" || code === "forbidden") {
        return jsonErr(rid, "Ugyldig cron-secret.", 403, "FORBIDDEN");
      }
      return jsonErr(rid, "Cron-gate feilet.", 500, "CRON_AUTH_ERROR");
    }

    opsLog("cron.resolve_experiments.start", {
      rid,
      minImpressionsPerVariant: EXPERIMENT_MIN_IMPRESSIONS_FOR_WINNER,
      resolveMode: process.env.LP_EXPERIMENT_RESOLVE_MODE ?? "legacy",
    });

    const supabase = supabaseAdmin();

    const resolveMode = String(process.env.LP_EXPERIMENT_RESOLVE_MODE ?? "")
      .trim()
      .toLowerCase();
    if (resolveMode === "moo") {
      const moo = await runMooResolveBatch({ rid, supabase });
      opsLog("cron.resolve_experiments.moo_done", {
        rid,
        resolved: moo.resolved,
        skipped: moo.skipped,
        experimentsProcessed: moo.experimentsProcessed,
        totalRunning: moo.totalRunning,
      });
      return jsonOk(rid, moo, 200);
    }
    const { data: running, error: listErr } = await supabase.from("experiments").select("id").eq("status", "running");
    if (listErr) {
      return jsonErr(rid, listErr.message, 500, "DB_ERROR");
    }

    const resolved: string[] = [];
    const skipped: string[] = [];
    const validationFailed: string[] = [];

    for (const row of running ?? []) {
      const experimentId = String((row as { id: string }).id ?? "");
      if (!experimentId) continue;

      const decision = await pickWinner(experimentId);
      opsLog("cron.resolve_experiments.candidate", {
        rid,
        experimentId,
        picked: decision.ok,
        reason: decision.ok ? decision.reason : decision.reason,
      });

      if (!decision.ok) {
        skipped.push(experimentId);
        continue;
      }

      const { data: expRow } = await supabase.from("experiments").select("content_id").eq("id", experimentId).maybeSingle();
      const pageId = String((expRow as { content_id?: string } | null)?.content_id ?? "").trim();

      const applied = await withCmsPageDocumentGate("api/cron/resolve-experiments/POST", async () =>
        applyExperimentWinnerToCms({
          experimentId,
          winnerVariantId: decision.winnerVariantId,
          applyProd: true,
          rid,
        }),
      );

      if (applied.ok) {
        resolved.push(experimentId);
        let prodValidated = false;
        if (pageId) {
          const v = await validateWinnerAppliedToProd({
            experimentId,
            pageId,
            winnerVariantId: decision.winnerVariantId,
          });
          prodValidated = v.ok;
          if (!v.ok) {
            validationFailed.push(experimentId);
            opsLog("auto_apply.validation_failed", {
              rid,
              experimentId,
              pageId,
              winnerVariantId: decision.winnerVariantId,
              detail: v.detail ?? "unknown",
            });
          }
        } else {
          validationFailed.push(experimentId);
          opsLog("auto_apply.validation_failed", {
            rid,
            experimentId,
            winnerVariantId: decision.winnerVariantId,
            detail: "missing_page_id",
          });
        }

        opsLog("auto_apply", {
          rid,
          experimentId,
          winnerVariantId: decision.winnerVariantId,
          pageId: pageId || null,
          applyProd: true,
          prodValidated,
          thresholdMet: true,
        });
        opsLog("cron.resolve_experiments.applied_prod", {
          rid,
          experimentId,
          winnerVariantId: decision.winnerVariantId,
          prodValidated,
        });
        opsLog("experiment_resolved", {
          rid,
          experimentId,
          winnerVariantId: decision.winnerVariantId,
          channel: "cron_auto_apply",
          applyProd: true,
        });
      } else {
        skipped.push(experimentId);
        opsLog("cron.resolve_experiments.apply_failed", {
          rid,
          experimentId,
          message: applied.ok === false ? applied.message : "",
        });
      }
    }

    return jsonOk(
      rid,
      { resolved, skipped, validationFailed, totalRunning: (running ?? []).length },
      200,
    );
  });
}
