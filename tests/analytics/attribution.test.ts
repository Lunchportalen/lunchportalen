import { describe, expect, test } from "vitest";

import { aggregateBlockAttribution } from "@/lib/analytics/attribution";
import type { CanonicalRevenueEvent } from "@/lib/analytics/events";

function ev(p: Partial<CanonicalRevenueEvent> & Pick<CanonicalRevenueEvent, "type" | "page">): CanonicalRevenueEvent {
  return {
    page: p.page,
    type: p.type,
    timestamp: p.timestamp ?? new Date().toISOString(),
    metadata: p.metadata ?? {},
    ...p,
  };
}

describe("aggregateBlockAttribution", () => {
  test("groups revenue by block", () => {
    const events: CanonicalRevenueEvent[] = [
      ev({ type: "page_view", page: "p1", blockId: "hero", metadata: { cms_block_id: "hero" } }),
      ev({ type: "cta_click", page: "p1", blockId: "cta1", metadata: { cms_block_id: "cta1" } }),
      ev({
        type: "conversion",
        page: "p1",
        blockId: "cta1",
        metadata: { cms_block_id: "cta1", revenue_cents: 1000 },
        revenueCents: 1000,
      }),
    ];
    const { byBlock, pageTotals } = aggregateBlockAttribution(events);
    expect(pageTotals.views).toBe(1);
    expect(pageTotals.conversions).toBe(1);
    const cta = byBlock.find((b) => b.blockId === "cta1");
    expect(cta?.ctaClicks).toBe(1);
    expect(cta?.conversions).toBe(1);
    expect(cta?.revenueCents).toBe(1000);
  });
});
