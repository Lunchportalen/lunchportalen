/**
 * Kill-switch: ekstremt svak ROAS → anbefal pause (ingen auto-handling her).
 */

export function shouldPauseCampaign(campaign: { roas: number }): boolean {
  if (campaign.roas < 0.5) return true;
  return false;
}
