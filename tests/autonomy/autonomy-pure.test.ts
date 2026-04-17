import { describe, expect, it } from "vitest";

import { autonomyPolicy, resolveAutonomyPolicy } from "@/lib/autonomy/policy";
import { prioritizeActions } from "@/lib/autonomy/priorities";
import { enforceGlobalCaps } from "@/lib/autonomy/protection";
import { generateActions } from "@/lib/autonomy/generateActions";
import { validateAction } from "@/lib/autonomy/validator";
import type { AutonomousAction } from "@/lib/autonomy/types";

describe("autonomy policy defaults", () => {
  it("master av og ingen auto-flagg", () => {
    expect(autonomyPolicy.enabled).toBe(false);
    expect(autonomyPolicy.allowAutoAds).toBe(false);
  });

  it("resolve fra toggles", () => {
    const p = resolveAutonomyPolicy({
      autonomy_master_enabled: true,
      autonomy_allow_auto_ads: true,
      autonomy_allow_auto_pricing: false,
      autonomy_allow_auto_procurement: false,
    });
    expect(p.enabled).toBe(true);
    expect(p.allowAutoAds).toBe(true);
  });
});

describe("enforceGlobalCaps", () => {
  it("fryser annonser over total-tak", () => {
    const r = enforceGlobalCaps({ totalSpend: 25000 }, autonomyPolicy);
    expect(r).toBe("freeze_ads");
  });

  it("stopper skalering ved lav ROAS", () => {
    const r = enforceGlobalCaps({ totalSpend: 1000, roas: 1.5 }, autonomyPolicy);
    expect(r).toBe("stop_scaling");
  });
});

describe("validateAction", () => {
  const ads: AutonomousAction = {
    type: "ads_adjust",
    reason: "t",
    expectedProfit: 1,
    riskLevel: "low",
    payload: { dailySpend: 100 },
  };

  it("avviser når master av", () => {
    expect(validateAction(ads, { dailySpend: 100 }, autonomyPolicy)).toBe(false);
  });

  it("tillater annonse når policy og tak OK", () => {
    const p = resolveAutonomyPolicy({
      autonomy_master_enabled: true,
      autonomy_allow_auto_ads: true,
    });
    expect(validateAction(ads, { dailySpend: 100 }, p)).toBe(true);
  });
});

describe("prioritizeActions", () => {
  it("sorterer synkende expectedProfit", () => {
    const a: AutonomousAction[] = [
      { type: "content_generate", reason: "a", expectedProfit: 10, riskLevel: "low" },
      { type: "ads_adjust", reason: "b", expectedProfit: 99, riskLevel: "medium" },
    ];
    const o = prioritizeActions(a);
    expect(o[0].type).toBe("ads_adjust");
  });
});

describe("generateActions", () => {
  it("tom når dataComplete false", () => {
    expect(generateActions({ dataComplete: false, signals: {} })).toEqual([]);
  });

  it("genererer deterministisk liste", () => {
    const g = generateActions({
      dataComplete: true,
      signals: { wantContent: true },
    });
    expect(g.some((x) => x.type === "content_generate")).toBe(true);
  });
});
