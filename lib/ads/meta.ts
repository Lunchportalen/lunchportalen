/**
 * Meta Ads — placeholder (ingen ekte spend før integrasjon er aktivert).
 */

import "server-only";

import type { AdsCreateCampaignInput } from "@/lib/ads/providers";
import { opsLog } from "@/lib/ops/log";
import { getTopPerformingPosts } from "@/lib/social/performance";

export async function createMetaCampaign(_input: AdsCreateCampaignInput): Promise<Record<string, unknown>> {
  return {
    status: "mock_created",
    platform: "meta",
  };
}

export type MetaScaleAdResult = {
  platform: "meta";
  status: "active" | "blocked";
  budget: number;
  content: unknown;
};

/**
 * Mock boost — loggført, budsjett begrenset. Ekte spend krever Meta Marketing API + godkjenning.
 */
export async function createMetaAd(input: { content: unknown; budget: number }): Promise<MetaScaleAdResult> {
  if (String(process.env.LP_SCALE_KILL_SWITCH ?? "").trim() === "true") {
    opsLog("scale_meta_ad_blocked", { reason: "LP_SCALE_KILL_SWITCH" });
    return { platform: "meta", status: "blocked", budget: 0, content: input.content };
  }
  const cap = Number(process.env.LP_ADS_MAX_SINGLE_AD_NOK ?? "500");
  const raw = Number.isFinite(input.budget) ? input.budget : 0;
  const b = Math.min(raw, Number.isFinite(cap) && cap > 0 ? cap : 500);
  opsLog("scale_meta_ad_mock", { budget: b });
  return { platform: "meta", status: "active", budget: b, content: input.content };
}

export async function boostTopPosts(): Promise<{ created: number }> {
  if (String(process.env.LP_SCALE_KILL_SWITCH ?? "").trim() === "true") {
    opsLog("scale_boost_blocked", { reason: "LP_SCALE_KILL_SWITCH" });
    return { created: 0 };
  }
  const posts = await getTopPerformingPosts();
  let created = 0;
  for (const p of posts.slice(0, 2)) {
    await createMetaAd({ content: p, budget: 200 });
    created += 1;
  }
  opsLog("scale_boost_tick", { created, candidateCount: posts.length });
  return { created };
}
