import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { sumOrdersForSocialPost } from "@/lib/growth/aggregateGrowth";
import { persistStrategyBoosts, persistStrategyPenalties } from "@/lib/learning/boosts";
import { promoteWinner } from "@/lib/experiment/promote";
import { pickWinner } from "@/lib/experiment/winner";
import type { SupabaseClient } from "@supabase/supabase-js";

import { opsLog } from "@/lib/ops/log";

const ROUTE = "run_social_ab_evaluations";

/** Minst én krone forskjell før promote/penalty (unngår støy). */
const MIN_UPLIFT_KR = 1;

export type SocialAbEvaluationSummary = {
  evaluated: number;
  promoted: number;
  completed: number;
  skipped: number;
};

/**
 * Aktive `ab_experiments`: mål omsetning per variant-post, promoter B→A ved tydelig B-seier, logg læring.
 * Idempotent: kun `status = active`; fullførte hoppes over neste kjøring.
 */
export async function runSocialAbEvaluations(
  admin: SupabaseClient,
  rid: string
): Promise<SocialAbEvaluationSummary> {
  const okExp = await verifyTable(admin, "ab_experiments", ROUTE);
  const okVar = await verifyTable(admin, "ab_variants", ROUTE);
  if (!okExp || !okVar) {
    return { evaluated: 0, promoted: 0, completed: 0, skipped: 0 };
  }

  const { data: active, error: listErr } = await admin.from("ab_experiments").select("id, name").eq("status", "active").limit(40);
  if (listErr || !Array.isArray(active)) {
    opsLog("social_ab_eval_list_failed", { rid, message: listErr?.message });
    return { evaluated: 0, promoted: 0, completed: 0, skipped: 0 };
  }

  let evaluated = 0;
  let promoted = 0;
  let completed = 0;
  let skipped = 0;

  for (const row of active) {
    const experimentId = String((row as { id?: unknown }).id ?? "");
    if (!experimentId) continue;

    const { data: vars, error: vErr } = await admin
      .from("ab_variants")
      .select("social_post_id, label")
      .eq("experiment_id", experimentId);
    if (vErr || !Array.isArray(vars) || vars.length < 2) {
      skipped += 1;
      continue;
    }

    const a = vars.find((v) => String((v as Record<string, unknown>).label ?? "").toUpperCase() === "A") as
      | { social_post_id?: string }
      | undefined;
    const b = vars.find((v) => String((v as Record<string, unknown>).label ?? "").toUpperCase() === "B") as
      | { social_post_id?: string }
      | undefined;
    const postA = typeof a?.social_post_id === "string" ? a.social_post_id : "";
    const postB = typeof b?.social_post_id === "string" ? b.social_post_id : "";
    if (!postA || !postB) {
      skipped += 1;
      continue;
    }

    const revA = await sumOrdersForSocialPost(admin, postA);
    const revB = await sumOrdersForSocialPost(admin, postB);
    const metrics = { A: revA.revenue, B: revB.revenue };
    const decision = pickWinner(metrics);
    evaluated += 1;

    const uplift = decision.uplift;

    const logLearning = async (extra: Record<string, unknown>) => {
      const lr = buildAiActivityLogRow({
        action: "learning_pattern",
        metadata: {
          kind: "experiment_learning",
          rid,
          experiment_id: experimentId,
          metrics,
          winner: decision.winner,
          uplift,
          ...extra,
        },
      });
      await admin.from("ai_activity_log").insert({ ...lr, rid, status: "success" } as Record<string, unknown>);
    };

    let promotedOk = false;
    if (decision.winner === "B" && metrics.B > metrics.A + MIN_UPLIFT_KR) {
      const pr = await promoteWinner(admin, {
        rid,
        winnerPostId: postB,
        targetPostId: postA,
      });
      if (pr.ok) {
        promotedOk = true;
        promoted += 1;
        await persistStrategyBoosts(admin, {
          rid,
          boosts: { social_ab_revenue_winner_b: 1.04 },
        });
      } else {
        opsLog("social_ab_promote_failed", { rid, experimentId, error: pr.ok === false ? pr.error : "" });
      }
    } else if (decision.winner === "A" && metrics.A > metrics.B + MIN_UPLIFT_KR) {
      await persistStrategyPenalties(admin, {
        rid,
        penalties: { social_ab_revenue_winner_b: 0.97 },
      });
    }

    await logLearning({
      promoted: promotedOk,
      note:
        metrics.A === 0 && metrics.B === 0
          ? "zero_revenue_both_arms"
          : Math.abs(metrics.B - metrics.A) < MIN_UPLIFT_KR
            ? "tie_or_noise_band"
            : undefined,
    });

    const { error: upErr } = await admin.from("ab_experiments").update({ status: "completed" }).eq("id", experimentId);
    if (!upErr) completed += 1;
    else opsLog("social_ab_complete_failed", { rid, experimentId, message: upErr.message });
  }

  opsLog("social_ab_eval_summary", { rid, evaluated, promoted, completed, skipped });
  return { evaluated, promoted, completed, skipped };
}
