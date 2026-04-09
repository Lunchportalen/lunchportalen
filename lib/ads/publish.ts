/**
 * Trygg publisering: aldri live uten eksplisitt godkjenning, budsjett > 0 og creativ.
 * Profit-/kapitalkontroll (superadmin) ligger i `profitExecution` — endrer ikke denne flyten og trigger ikke auto-spend.
 */

import "server-only";

import { getAdsProvider } from "@/lib/ads/providers";
import type { AdsCreateCampaignInput } from "@/lib/ads/providers";

export type PublishCampaignResult =
  | { status: "pending_approval" }
  | { status: "no_provider" }
  | { status: "blocked_no_budget"; message: string }
  | { status: "blocked_no_creative"; message: string }
  | Record<string, unknown>;

/**
 * @param approved — må være true etter server-verifisert godkjenning (HMAC), aldri kun klient-flagg alene.
 */
export async function publishCampaign(
  campaign: AdsCreateCampaignInput,
  approved: boolean,
): Promise<PublishCampaignResult> {
  if (!approved) {
    return { status: "pending_approval" };
  }
  if (!(typeof campaign.budget === "number" && Number.isFinite(campaign.budget) && campaign.budget > 0)) {
    return { status: "blocked_no_budget", message: "Budsjett må være satt (> 0) før publisering" };
  }
  const creative = campaign.creative != null ? String(campaign.creative).trim() : "";
  if (!creative) {
    return { status: "blocked_no_creative", message: "Mangler creativ (video-URL)" };
  }

  const provider = getAdsProvider();
  if (!provider) {
    return { status: "no_provider" };
  }

  return provider.createCampaign(campaign);
}
