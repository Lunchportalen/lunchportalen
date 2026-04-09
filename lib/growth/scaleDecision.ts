import type { ChannelMetricsMap } from "@/lib/growth/channelMetrics";

/** NOK per post — over = anbefaling om skalering (kun forslag, ingen auto-spend). */
export const SCALE_REVENUE_PER_POST_THRESHOLD_NOK = 5000;
/** NOK per post — under = anbefaling om reduksjon / omtanke. */
export const REDUCE_REVENUE_PER_POST_THRESHOLD_NOK = 500;

export type ScalingAction = {
  channel: string;
  action: "scale" | "reduce";
  reason: string;
};

export function decideScaling(metrics: ChannelMetricsMap): ScalingAction[] {
  const actions: ScalingAction[] = [];

  for (const [channel, m] of Object.entries(metrics)) {
    if (m.revenuePerPost > SCALE_REVENUE_PER_POST_THRESHOLD_NOK) {
      actions.push({
        channel,
        action: "scale",
        reason: "Høy omsetning per post (attribuert)",
      });
    }
    if (m.posts > 0 && m.revenuePerPost < REDUCE_REVENUE_PER_POST_THRESHOLD_NOK) {
      actions.push({
        channel,
        action: "reduce",
        reason: "Lav effektivitet per post (vurder målgruppe / budskap)",
      });
    }
  }

  return actions;
}
