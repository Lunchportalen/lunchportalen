import "server-only";

import { opsLog } from "@/lib/ops/log";

export type CampaignEvent = Record<string, unknown> & {
  name?: string;
};

export function trackCampaignEvent(event: CampaignEvent): CampaignEvent & { timestamp: number } {
  const row = {
    ...event,
    timestamp: Date.now(),
  };
  opsLog("campaign_event", row as Record<string, unknown>);
  return row;
}
