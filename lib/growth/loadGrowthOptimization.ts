import "server-only";

import { loadActiveExperimentVariants } from "@/lib/growth/abAssign";
import { buildVariantScoreRows, loadOrderCountsByPostId } from "@/lib/growth/aggregateGrowth";
import { extractPatterns } from "@/lib/growth/learning";
import { recommendNextPost } from "@/lib/growth/recommend";
import { pickWinner } from "@/lib/growth/winner";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "load_growth_optimization";

export type GrowthOptimizationUiPayload = {
  explain: string;
  experimentName: string | null;
  experimentId: string | null;
  best: Array<{
    variantId: string;
    label: string | null;
    socialPostId: string;
    revenuePerClick: number;
    ctr: number;
    conversion: number;
    funnel: { clicks: number; leads: number; orders: number; revenue: number };
  }>;
  worst: Array<{
    variantId: string;
    label: string | null;
    socialPostId: string;
    revenuePerClick: number;
    ctr: number;
    conversion: number;
    funnel: { clicks: number; leads: number; orders: number; revenue: number };
  }>;
  recommendation: { suggestion: string; reason: string } | null;
};

function toRow(s: Awaited<ReturnType<typeof buildVariantScoreRows>>[number]) {
  return {
    variantId: s.variantId,
    label: s.label,
    socialPostId: s.socialPostId,
    revenuePerClick: s.metrics.revenuePerClick,
    ctr: s.metrics.ctr,
    conversion: s.metrics.conversion,
    funnel: s.funnel,
  };
}

export async function loadGrowthOptimizationUi(): Promise<GrowthOptimizationUiPayload> {
  const empty: GrowthOptimizationUiPayload = {
    explain: "Ingen aktive A/B-eksperimenter eller utilstrekkelig data — ingen automatisk beslutning.",
    experimentName: null,
    experimentId: null,
    best: [],
    worst: [],
    recommendation: null,
  };

  try {
    if (!hasSupabaseAdminConfig()) return empty;
    const admin = supabaseAdmin();
    const loaded = await loadActiveExperimentVariants(admin, ROUTE);
    if (!loaded) return empty;

    const scores = await buildVariantScoreRows(admin, loaded.variants);
    if (scores.length === 0) {
      return {
        ...empty,
        experimentId: loaded.experimentId,
        experimentName: loaded.experimentName,
        explain: "Eksperiment funnet, men ingen varianter å score.",
      };
    }

    const sorted = [...scores].sort((a, b) => b.metrics.revenuePerClick - a.metrics.revenuePerClick);
    const best = sorted.slice(0, 3).map(toRow);
    const worst = [...sorted].reverse().slice(0, 3).map(toRow);

    const postIds = [...new Set(loaded.variants.map((v) => v.social_post_id))];
    const { data: posts } = await admin.from("social_posts").select("id, content").in("id", postIds);
    const orderCounts = await loadOrderCountsByPostId(admin, postIds);
    const patterns = extractPatterns(
      Array.isArray(posts) ? posts.map((p) => ({ id: String((p as Record<string, unknown>).id), content: (p as Record<string, unknown>).content })) : [],
      orderCounts,
    );
    const recommendation = recommendNextPost(patterns);

    const winner = pickWinner(scores);
    const explain = winner
      ? `Vinner etter omsetning per klikk: variant ${winner.label ?? winner.variantId} (deterministisk sortering).`
      : "Ingen vinner ennå — minst én ikke-null funnel kreves.";

    return {
      explain,
      experimentName: loaded.experimentName,
      experimentId: loaded.experimentId,
      best,
      worst,
      recommendation,
    };
  } catch {
    return empty;
  }
}
