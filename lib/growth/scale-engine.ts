import "server-only";

import { boostTopPosts } from "@/lib/ads/meta";
import { runAutoSocial } from "@/lib/social/auto-post";
import { optimizeBudget, type ScaleChannelRow } from "@/lib/growth/optimizer";
import { getGrowthMetrics } from "@/lib/growth/scaleMetrics";
import { opsLog } from "@/lib/ops/log";

/**
 * Orkestrering — ingen ekte annonsespend uten egen ads-integrasjon + godkjenning.
 */
export async function runScaleEngine(): Promise<{
  status: "scaling" | "blocked";
  autoSocial: Awaited<ReturnType<typeof runAutoSocial>>;
  boost: Awaited<ReturnType<typeof boostTopPosts>>;
  channels: ScaleChannelRow[];
}> {
  if (String(process.env.LP_SCALE_KILL_SWITCH ?? "").trim() === "true") {
    opsLog("scale_engine_blocked", { reason: "LP_SCALE_KILL_SWITCH" });
    return {
      status: "blocked",
      autoSocial: { status: "blocked", count: 0 },
      boost: { created: 0 },
      channels: [],
    };
  }

  const autoSocial = await runAutoSocial();
  const boost = await boostTopPosts();
  const metrics = await getGrowthMetrics();
  const optimized = optimizeBudget(metrics.channels);

  opsLog("scale_engine_tick", { autoSocial, boost, channelCount: optimized.length });
  return { status: "scaling", autoSocial, boost, channels: optimized };
}
