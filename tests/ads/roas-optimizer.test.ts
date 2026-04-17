import { describe, expect, it } from "vitest";

import { clamp } from "@/lib/ads/clamp";
import { classifyCampaign } from "@/lib/ads/classifier";
import { computeNextBudgetWithGuardrails } from "@/lib/ads/execution";
import { optimizeBudget, suggestBudgetAfterRoasMultipliers } from "@/lib/ads/optimizer";
import { calculateROAS } from "@/lib/ads/roas";
import { budgetRules } from "@/lib/ads/rules";
import { shouldPauseCampaign } from "@/lib/ads/safety";

describe("calculateROAS", () => {
  it("returns 0 uten spend", () => {
    expect(calculateROAS({ spend: 0, revenue: 100 })).toBe(0);
    expect(calculateROAS({ spend: 0, revenue: 0 })).toBe(0);
  });
  it("beregner revenue/spend", () => {
    expect(calculateROAS({ spend: 10, revenue: 40 })).toBe(4);
  });
});

describe("classifyCampaign", () => {
  it("winner / loser / neutral", () => {
    expect(classifyCampaign({ spend: 10, revenue: 35 })).toBe("winner");
    expect(classifyCampaign({ spend: 10, revenue: 5 })).toBe("loser");
    expect(classifyCampaign({ spend: 10, revenue: 20 })).toBe("neutral");
  });
});

describe("clamp", () => {
  it("respekterer min og max", () => {
    expect(clamp(10)).toBe(budgetRules.minBudget);
    expect(clamp(99999)).toBe(budgetRules.maxBudget);
    expect(clamp(500)).toBe(500);
  });
});

describe("optimizeBudget (spesifikasjon)", () => {
  it("øker ved ROAS > 3 og senker ved ROAS < 1", () => {
    expect(optimizeBudget({ budget: 100, spend: 10, revenue: 40 })).toBe(120);
    expect(optimizeBudget({ budget: 100, spend: 10, revenue: 5 })).toBe(80);
    expect(optimizeBudget({ budget: 100, spend: 10, revenue: 25 })).toBe(100);
  });
});

describe("computeNextBudgetWithGuardrails", () => {
  it("vinner-scenario: +20 % og innen daglig tak (+30 %)", () => {
    const base = 1000;
    const raw = suggestBudgetAfterRoasMultipliers({ budget: base, spend: 10, revenue: 50 });
    expect(raw).toBe(1200);
    const g = computeNextBudgetWithGuardrails({ budget: base, spend: 10, revenue: 50, paused: false });
    expect(g.nextBudget).toBe(1200);
    expect(g.nextBudget).toBeLessThanOrEqual(Math.round(base * (1 + budgetRules.maxDailyIncrease)));
    expect(g.nextBudget).toBeGreaterThanOrEqual(budgetRules.minBudget);
  });
  it("taper-scenario: −20 % matcher daglig reduksjonsgrense", () => {
    const base = 1000;
    const g = computeNextBudgetWithGuardrails({ budget: base, spend: 100, revenue: 90, paused: false });
    expect(g.nextBudget).toBe(800);
    expect(g.nextBudget).toBeGreaterThanOrEqual(Math.round(base * (1 - budgetRules.maxDailyDecrease)));
  });
  it("pauseRecommended blokkerer justering", () => {
    const g = computeNextBudgetWithGuardrails({ budget: 200, spend: 100, revenue: 40, paused: false });
    expect(shouldPauseCampaign({ roas: g.roas })).toBe(true);
    expect(g.nextBudget).toBe(200);
    expect(g.pauseRecommended).toBe(true);
  });
  it("paused lar budsjett være urørt", () => {
    const g = computeNextBudgetWithGuardrails({ budget: 300, spend: 10, revenue: 50, paused: true });
    expect(g.nextBudget).toBe(300);
  });
});

describe("shouldPauseCampaign", () => {
  it("true under 0.5 ROAS", () => {
    expect(shouldPauseCampaign({ roas: 0.49 })).toBe(true);
    expect(shouldPauseCampaign({ roas: 0.5 })).toBe(false);
  });
});
