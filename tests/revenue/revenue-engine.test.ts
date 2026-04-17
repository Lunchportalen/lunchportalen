import { describe, expect, it } from "vitest";

import { linkCampaignToRevenue } from "@/lib/ads/linking";
import { enforceDailyLimits } from "@/lib/engine/budget";
import { globalSafety } from "@/lib/engine/safety";
import { scoreAttribution } from "@/lib/revenue/confidence";
import { calculateTrueProfit } from "@/lib/revenue/cost";
import { summarizeClosedLoopEngine } from "@/lib/revenue/engineView";
import { filterReliableEvents } from "@/lib/revenue/filter";
import { buildRevenueEvents, buildRevenueEventsFromCalendarPosts } from "@/lib/revenue/pipeline";
import { isTraceableRevenueEvent, type RevenueEvent } from "@/lib/revenue/unified";
import type { CalendarPost } from "@/lib/social/calendar";

describe("buildRevenueEvents", () => {
  it("filtrerer bort ai_social uten postId", () => {
    const ev = buildRevenueEvents([
      {
        id: "o1",
        productId: "p1",
        total: 100,
        created_at: 1,
        source: "ai_social",
      },
    ]);
    expect(ev).toHaveLength(0);
  });

  it("mapper ordre med attributjon", () => {
    const ev = buildRevenueEvents([
      {
        id: "o1",
        productId: "p1",
        total: 200,
        created_at: 10,
        attribution: {
          postId: "post_1",
          source: "ai_social",
          campaignId: "camp_1",
        },
      },
    ]);
    expect(ev).toHaveLength(1);
    expect(ev[0].campaignId).toBe("camp_1");
    expect(isTraceableRevenueEvent(ev[0])).toBe(true);
  });
});

describe("calculateTrueProfit", () => {
  it("fail-closed uten spend", () => {
    const e: RevenueEvent = {
      orderId: "o",
      productId: "p",
      amount: 50,
      source: "direct",
      timestamp: 1,
    };
    expect(calculateTrueProfit(e, null).ok).toBe(false);
  });

  it("fail-closed ved svak attributjon (profit beskyttet)", () => {
    const e: RevenueEvent = {
      orderId: "o",
      productId: "p",
      amount: 500,
      postId: "only_post",
      source: "ai_social",
      timestamp: 1,
    };
    expect(scoreAttribution(e)).toBeLessThanOrEqual(0.7);
    const r = calculateTrueProfit(e, { spend: 10 });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.reason).toBe("weak_attribution");
  });
});

describe("linkCampaignToRevenue", () => {
  it("matcher postId eller campaignId", () => {
    const events: RevenueEvent[] = [
      {
        orderId: "1",
        productId: "p",
        amount: 10,
        postId: "x",
        campaignId: "y",
        source: "ai_social",
        timestamp: 1,
      },
    ];
    expect(linkCampaignToRevenue({ id: "x" }, events)).toHaveLength(1);
    expect(linkCampaignToRevenue({ id: "y" }, events)).toHaveLength(1);
  });
});

describe("summarizeClosedLoopEngine", () => {
  it("velger best/worst etter omsetning", () => {
    const events: RevenueEvent[] = [
      {
        orderId: "a",
        productId: "p",
        amount: 100,
        postId: "p1",
        campaignId: "p1",
        source: "ai_social",
        timestamp: 1,
      },
      {
        orderId: "b",
        productId: "p",
        amount: 20,
        postId: "p2",
        campaignId: "p2",
        source: "ai_social",
        timestamp: 2,
      },
    ];
    const s = summarizeClosedLoopEngine(events, [
      { id: "p1", spend: 40, budget: 100 },
      { id: "p2", spend: 10, budget: 50 },
    ]);
    expect(s.bestCampaign?.id).toBe("p1");
    expect(s.worstCampaign?.id).toBe("p2");
    expect(s.totalRevenue).toBe(120);
    expect(s.signalRevenueTotal).toBe(120);
    expect(s.excludedWeakAttributionRevenue).toBe(0);
    expect(s.attributionReliabilityLabel).toBe("Høy sikkerhet");
  });

  it("ekskluderer svak attributjon fra profit og merker lav sikkerhet", () => {
    const strong: RevenueEvent = {
      orderId: "a",
      productId: "p",
      amount: 100,
      postId: "p1",
      campaignId: "p1",
      creativeId: "cr1",
      source: "ai_social",
      timestamp: 1,
    };
    const weak: RevenueEvent = {
      orderId: "b",
      productId: "p",
      amount: 999,
      postId: "orphan",
      source: "ai_social",
      timestamp: 2,
    };
    expect(scoreAttribution(weak)).toBeLessThanOrEqual(0.7);
    const s = summarizeClosedLoopEngine([strong, weak], [{ id: "p1", spend: 10, budget: 50 }]);
    expect(s.totalRevenue).toBe(100);
    expect(s.signalRevenueTotal).toBe(1099);
    expect(s.excludedWeakAttributionRevenue).toBe(999);
    expect(s.attributionReliabilityLabel).toBe("Lav sikkerhet");
    expect(filterReliableEvents([strong, weak])).toHaveLength(1);
  });
});

describe("buildRevenueEventsFromCalendarPosts", () => {
  it("kun publisert med positiv omsetning", () => {
    const posts: CalendarPost[] = [
      {
        id: "cal1",
        productId: "prod",
        slotDay: "2025-01-01",
        scheduledAt: 1,
        status: "published",
        performance: { clicks: 0, conversions: 0, revenue: 55 },
      },
      {
        id: "cal2",
        productId: "prod",
        slotDay: "2025-01-01",
        scheduledAt: 1,
        status: "planned",
        performance: { clicks: 0, conversions: 0, revenue: 99 },
      },
    ];
    const ev = buildRevenueEventsFromCalendarPosts(posts);
    expect(ev).toHaveLength(1);
    expect(ev[0].postId).toBe("cal1");
  });
});

describe("globalSafety + enforceDailyLimits", () => {
  it("fryser ved lav ROAS", () => {
    expect(globalSafety({ roas: 1.2 })).toBe("freeze_all");
    expect(globalSafety({ roas: 2 })).toBe("ok");
  });
  it("capper budsjett", () => {
    expect(enforceDailyLimits({ budget: 99999 })).toBe(5000);
  });
});
