/**
 * TikTok Ads — placeholder (ingen ekte spend før integrasjon er aktivert).
 */

import "server-only";

import type { AdsCreateCampaignInput } from "@/lib/ads/providers";
import { opsLog } from "@/lib/ops/log";

export async function createTikTokCampaign(_input: AdsCreateCampaignInput): Promise<Record<string, unknown>> {
  return {
    status: "mock_created",
    platform: "tiktok",
  };
}

export type TikTokScaleAdResult = {
  platform: "tiktok";
  status: "active" | "blocked";
  budget: number;
  content: unknown;
};

export async function createTikTokAd(input: { content: unknown; budget: number }): Promise<TikTokScaleAdResult> {
  if (String(process.env.LP_SCALE_KILL_SWITCH ?? "").trim() === "true") {
    opsLog("scale_tiktok_ad_blocked", { reason: "LP_SCALE_KILL_SWITCH" });
    return { platform: "tiktok", status: "blocked", budget: 0, content: input.content };
  }
  const cap = Number(process.env.LP_ADS_MAX_SINGLE_AD_NOK ?? "500");
  const raw = Number.isFinite(input.budget) ? input.budget : 0;
  const b = Math.min(raw, Number.isFinite(cap) && cap > 0 ? cap : 500);
  opsLog("scale_tiktok_ad_mock", { budget: b });
  return { platform: "tiktok", status: "active", budget: b, content: input.content };
}
