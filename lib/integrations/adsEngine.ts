import "server-only";

import { INTEGRATIONS } from "@/lib/integrations/config";
import { deterministicIntegrationId } from "@/lib/integrations/deterministicId";
import { opsLog } from "@/lib/ops/log";

export type LaunchAdCampaignResult = {
  ok: boolean;
  campaignId?: string;
  mode: "simulated" | "disabled";
  detail?: string;
};

/**
 * No direct ad spend. When ADS_ENABLED=true we still only emit a deterministic simulated campaign id + full audit log.
 */
export async function launchAdCampaign(
  action: unknown,
  ctx: { rid: string },
): Promise<LaunchAdCampaignResult> {
  if (!INTEGRATIONS.ads.enabled) {
    opsLog("ads_launch_skipped", { rid: ctx.rid, reason: "ADS_ENABLED_not_true", action });
    return { ok: false, mode: "disabled", detail: "ADS_DISABLED" };
  }

  const campaignId = deterministicIntegrationId("sim_ad", [ctx.rid, JSON.stringify(action ?? null)]);
  opsLog("ads_launch", { rid: ctx.rid, action, campaignId, note: "simulated_no_spend" });

  return {
    ok: true,
    campaignId,
    mode: "simulated",
    detail: "simulated_safe_execution",
  };
}
