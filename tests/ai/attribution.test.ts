import { describe, expect, test } from "vitest";

import { aggregateAttribution, normalizeAttributionRow } from "@/lib/ai/attribution/aggregationEngine";
import { buildAttributionRecord } from "@/lib/ai/attribution/attributionModel";
import { buildAttributionInsights } from "@/lib/ai/attribution/insightEngine";
import { calculateROI } from "@/lib/ai/attribution/roiEngine";

describe("attribution layer", () => {
  test("buildAttributionRecord normalizes metrics", () => {
    const r = buildAttributionRecord({
      actionType: "experiment",
      source: "t",
      metrics: { impressions: 1, clicks: 2, conversions: 0.5, revenue: 100 },
    });
    expect(r.actionType).toBe("experiment");
    expect(r.metrics.impressions).toBe(1);
    expect(r.metrics.clicks).toBe(2);
    expect(r.metrics.conversions).toBe(0.5);
    expect(r.metrics.revenue).toBe(100);
  });

  test("normalizeAttributionRow reads ai_memory-shaped rows", () => {
    const row = {
      kind: "attribution_cycle",
      payload: {
        actionType: "revenue",
        source: "tripletex",
        metrics: { revenue: 200, conversions: 1 },
        timestamp: 1,
      },
    };
    const n = normalizeAttributionRow(row);
    expect(n?.actionType).toBe("revenue");
    expect(n?.metrics.revenue).toBe(200);
  });

  test("aggregateAttribution + calculateROI are deterministic", () => {
    const records = [
      buildAttributionRecord({
        actionType: "experiment",
        source: "public_tracking",
        metrics: { revenue: 0, conversions: 1 },
      }),
      buildAttributionRecord({
        actionType: "revenue",
        source: "tripletex",
        metrics: { revenue: 100, conversions: 1 },
      }),
    ];
    const agg = aggregateAttribution(records);
    const roi = calculateROI(agg);
    const insights = buildAttributionInsights(records);
    expect(insights.aggregated.experiment?.conversions).toBe(1);
    expect(insights.aggregated.revenue?.revenue).toBe(100);
    expect(roi[0].action).toBe("revenue");
    expect(insights.bestAction).toBe("revenue");
  });
});
