import type { ChannelMetricsMap } from "@/lib/growth/channelMetrics";

export type ChannelRoiInput = { id: string; roi: number; [k: string]: unknown };

/**
 * ROI-weighted share (0–1 per channel). Additive — does not replace {@link allocateBudget}.
 */
export function allocateBudgetByRoi(channels: ChannelRoiInput[]): Array<ChannelRoiInput & { allocation: number }> {
  const total = channels.reduce((s, c) => s + Math.max(0, Number(c.roi) || 0), 0);
  return channels.map((c) => ({
    ...c,
    allocation: total > 0 ? Math.max(0, Number(c.roi) || 0) / total : 0,
  }));
}

/**
 * Fordeler et nominelt budsjett proporsjonalt med `revenuePerPost`.
 * Ingen eksekvering — kun tall til godkjenning.
 */
export function allocateBudget(metrics: ChannelMetricsMap, total = 100_000): Record<string, number> {
  const totalScore = Object.values(metrics).reduce((sum, m) => sum + Math.max(0, m.revenuePerPost), 0);
  const allocation: Record<string, number> = {};

  if (totalScore === 0) return allocation;

  for (const [channel, m] of Object.entries(metrics)) {
    const score = Math.max(0, m.revenuePerPost);
    allocation[channel] = (score / totalScore) * total;
  }

  return allocation;
}
