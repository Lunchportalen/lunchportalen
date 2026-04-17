import { describe, expect, it } from "vitest";

import type { AdAccount } from "@/lib/ads/accounts";
import { allocateBudget, type AllocationCampaign } from "@/lib/ads/allocation";
import { controlAccount, portfolioRoasPolicy, resolveAccountControlState } from "@/lib/ads/account";
import { assignCreativeVariants } from "@/lib/ads/testing";
import { diversify } from "@/lib/ads/risk";
import { getPortfolioMetrics } from "@/lib/ads/portfolio";
import { runPortfolioPlanner } from "@/lib/ads/portfolioPlanner";
import { rotateCreatives } from "@/lib/ads/rotation";
import { scaleAcrossAccounts } from "@/lib/ads/multiScale";

const accA: AdAccount = { id: "a1", name: "A", spend: 100, budget: 1000, status: "active" };
const accB: AdAccount = { id: "a2", name: "B", spend: 50, budget: 800, status: "active" };

describe("getPortfolioMetrics", () => {
  it("aggregatorer spend og revenue", () => {
    const m = getPortfolioMetrics([
      { spend: 10, revenue: 30 },
      { spend: 5, revenue: 5 },
    ]);
    expect(m.totalSpend).toBe(15);
    expect(m.totalRevenue).toBe(35);
    expect(m.roas).toBeCloseTo(35 / 15);
  });
});

describe("allocateBudget", () => {
  it("velger beste ROAS per konto og ignorerer ulønnsomme", () => {
    const campaigns: AllocationCampaign[] = [
      { id: "c1", accountId: "a1", budget: 500, spend: 100, revenue: 400, roas: 4 },
      { id: "c2", accountId: "a1", budget: 300, spend: 100, revenue: 50, roas: 0.5 },
      { id: "c3", accountId: "a2", budget: 200, spend: 50, revenue: 300, roas: 6 },
    ];
    const plan = allocateBudget([accA, accB], campaigns);
    expect(plan.find((p) => p.accountId === "a1")?.campaignId).toBe("c1");
    expect(plan.find((p) => p.accountId === "a2")?.campaignId).toBe("c3");
  });

  it("ingen rad når ingen når minROAS", () => {
    const bad: AllocationCampaign[] = [
      { id: "c1", accountId: "a1", budget: 500, spend: 100, revenue: 100, roas: 1 },
    ];
    expect(allocateBudget([accA], bad)).toHaveLength(0);
  });
});

describe("portfolioRoasPolicy", () => {
  it("reduce / scale / maintain", () => {
    expect(portfolioRoasPolicy(1.2).mode).toBe("reduce_all");
    expect(portfolioRoasPolicy(3.5).mode).toBe("scale_allowed");
    expect(portfolioRoasPolicy(2).mode).toBe("maintain");
  });
});

describe("resolveAccountControlState", () => {
  it("kombinerer spend-fryst og portfolio-policy", () => {
    const hi = resolveAccountControlState([{ spend: 25_000 }], 3.5);
    expect(hi.spendStatus).toBe("freeze_all");
    expect(hi.portfolioPolicy.mode).toBe("scale_allowed");
  });
});

describe("diversify", () => {
  it("flagger høy andel", () => {
    const d = diversify(
      [],
      [
        { id: "x", budget: 900 },
        { id: "y", budget: 100 },
      ],
      0.4,
    );
    expect(d[0].capped).toBe(true);
    expect(d[1].capped).toBe(false);
  });
});

describe("runPortfolioPlanner", () => {
  it("reduserer planlagt allokering ved lav portfolio ROAS", () => {
    const cWin: AllocationCampaign = {
      id: "c1",
      accountId: "a1",
      budget: 1000,
      spend: 200,
      revenue: 1000,
      roas: 5,
    };
    const cLose: AllocationCampaign = {
      id: "c2",
      accountId: "a2",
      budget: 500,
      spend: 800,
      revenue: 400,
      roas: 0.5,
    };
    const out = runPortfolioPlanner({
      accounts: [
        { id: "a1", name: "A", spend: 200, budget: 2000, status: "active" },
        { id: "a2", name: "B", spend: 800, budget: 500, status: "active" },
      ],
      campaigns: [cWin, cLose],
      creatives: [],
    });
    expect(out.metrics.roas).toBeLessThan(1.5);
    expect(out.portfolioPolicy.mode).toBe("reduce_all");
    expect(out.allocationBase.length).toBe(1);
    expect(out.allocationFinal[0].budget).toBe(Math.round(out.allocationBase[0].budget * 0.85));
  });

  it("deterministisk rotasjon", () => {
    const creatives = [
      { id: "b", videoUrl: "u", hook: "b", performance: { roas: 2, conversions: 0 } },
      { id: "a", videoUrl: "u", hook: "a", performance: { roas: 2, conversions: 0 } },
    ];
    const r = rotateCreatives(creatives);
    expect(r[0].id).toBe("a");
    expect(r[1].id).toBe("b");
  });

  it("variantvekter summerer til 1 for tre creativer", () => {
    const v = assignCreativeVariants(
      { id: "camp" },
      [
        { id: "1", videoUrl: "", hook: "" },
        { id: "2", videoUrl: "", hook: "" },
        { id: "3", videoUrl: "", hook: "" },
      ],
    );
    expect(v.reduce((s, x) => s + x.weight, 0)).toBeCloseTo(1);
  });
});

describe("scaleAcrossAccounts", () => {
  it("kun når beste ROAS > minRoasForMultiAccountScale", () => {
    const camps: AllocationCampaign[] = [
      { id: "c1", accountId: "a1", budget: 100, spend: 10, revenue: 35, roas: 3.5 },
    ];
    const s = scaleAcrossAccounts([accA], camps);
    expect(s[0]?.action).toBe("scale");
    const low: AllocationCampaign[] = [
      { id: "c1", accountId: "a1", budget: 100, spend: 10, revenue: 25, roas: 2.5 },
    ];
    expect(scaleAcrossAccounts([accA], low)[0]).toBeNull();
  });
});

describe("controlAccount", () => {
  it("bruker ikke-negativ spend", () => {
    expect(controlAccount([{ spend: -100 }, { spend: 30_000 }])).toBe("freeze_all");
  });
});
