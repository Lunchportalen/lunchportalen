import "server-only";

import { opsLog } from "@/lib/ops/log";

type LiveCounters = {
  emailsSent: number;
  socialPosts: number;
  clicks: number;
  revenueNok: number;
};

let c: LiveCounters = { emailsSent: 0, socialPosts: 0, clicks: 0, revenueNok: 0 };

export function recordLiveEmailSent(n = 1): void {
  c = { ...c, emailsSent: c.emailsSent + n };
  opsLog("live_counters", { ...c });
}

export function recordLiveSocialPost(n = 1): void {
  c = { ...c, socialPosts: c.socialPosts + n };
  opsLog("live_counters", { ...c });
}

export function recordLiveClick(n = 1): void {
  c = { ...c, clicks: c.clicks + n };
  opsLog("live_counters", { ...c });
}

export function recordLiveRevenue(nok: number): void {
  const v = Number.isFinite(nok) ? nok : 0;
  c = { ...c, revenueNok: c.revenueNok + v };
  opsLog("live_counters", { ...c });
}

export function getLiveCampaignMetrics(): { emails: number; posts: number; clicks: number; revenue: number } {
  return {
    emails: c.emailsSent,
    posts: c.socialPosts,
    clicks: c.clicks,
    revenue: c.revenueNok,
  };
}

export function resetLiveCampaignStatsForTests(): void {
  c = { emailsSent: 0, socialPosts: 0, clicks: 0, revenueNok: 0 };
}
