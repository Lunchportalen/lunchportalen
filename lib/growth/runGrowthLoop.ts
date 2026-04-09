import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { loadActiveExperimentVariants } from "@/lib/growth/abAssign";
import { buildVariantScoreRows, loadOrderCountsByPostId } from "@/lib/growth/aggregateGrowth";
import { extractPatterns } from "@/lib/growth/learning";
import { recommendNextPost } from "@/lib/growth/recommend";
import { pickWinner } from "@/lib/growth/winner";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "growth_loop";

async function logLearningPattern(metadata: Record<string, unknown>, rid: string): Promise<void> {
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;
    const row = buildAiActivityLogRow({
      action: "learning_pattern",
      metadata: { ...metadata, source: "growth_loop" },
    });
    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid,
      status: "success" as const,
    } as Record<string, unknown>);
    if (error) console.error("[runGrowthLoop] learning_pattern", error.message);
  } catch (e) {
    console.error("[runGrowthLoop] learning_pattern", e instanceof Error ? e.message : String(e));
  }
}

/**
 * Cron: mål ytelse, vinnere, mønstre, anbefaling — alt best-effort og observerbart i ai_activity_log.
 */
export async function runGrowthOptimizationLoop(rid: string): Promise<{
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  winnerVariantId?: string | null;
  patternsLogged?: number;
}> {
  try {
    if (!hasSupabaseAdminConfig()) {
      return { ok: true, skipped: true, reason: "no_config", winnerVariantId: null, patternsLogged: 0 };
    }
    const admin = supabaseAdmin();
    const loaded = await loadActiveExperimentVariants(admin, ROUTE);
    if (!loaded) {
      return { ok: true, skipped: true, reason: "no_active_experiment", winnerVariantId: null, patternsLogged: 0 };
    }

    const scores = await buildVariantScoreRows(admin, loaded.variants);
    const winner = pickWinner(scores);
    if (winner) {
      await logLearningPattern(
        {
          kind: "winner",
          experiment_id: loaded.experimentId,
          variant_id: winner.variantId,
          label: winner.label,
          revenue_per_click: winner.metrics.revenuePerClick,
          funnel: winner.funnel,
        },
        rid,
      );
    }

    const postIds = [...new Set(loaded.variants.map((v) => v.social_post_id))];
    const { data: posts, error: pErr } = await admin.from("social_posts").select("id, content").in("id", postIds);
    if (pErr) console.error("[runGrowthLoop] social_posts", pErr.message);

    const orderCounts = await loadOrderCountsByPostId(admin, postIds);
    const patterns = extractPatterns(
      Array.isArray(posts) ? posts.map((p) => ({ id: String((p as Record<string, unknown>).id), content: (p as Record<string, unknown>).content })) : [],
      orderCounts,
    );

    let patternsLogged = 0;
    for (const p of patterns) {
      await logLearningPattern({ hook: p.hook, success: p.success, post_id: p.postId }, rid);
      patternsLogged += 1;
    }

    const rec = recommendNextPost(patterns);
    if (rec) {
      await logLearningPattern(
        {
          kind: "recommendation",
          suggestion: rec.suggestion,
          reason: rec.reason,
        },
        rid,
      );
    }

    return {
      ok: true,
      winnerVariantId: winner?.variantId ?? null,
      patternsLogged,
    };
  } catch (e) {
    console.error("[runGrowthLoop]", e instanceof Error ? e.message : String(e));
    return { ok: false, skipped: true, reason: "exception", winnerVariantId: null, patternsLogged: 0 };
  }
}
