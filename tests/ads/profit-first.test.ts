import { describe, expect, it } from "vitest";

import { controlAccount } from "@/lib/ads/account";
import { decideAction } from "@/lib/ads/autonomy";
import { cutLosses } from "@/lib/ads/cut";
import { guardrails } from "@/lib/ads/guardrails";
import { calculateMargin, calculateProfit } from "@/lib/ads/profit";
import { classifyProfit } from "@/lib/ads/profitClassifier";
import { enforceCaps } from "@/lib/ads/protection";
import { evaluateProfitFirstRow, evaluateProfitFirstAll } from "@/lib/ads/profitExecution";
import { scaleCampaign } from "@/lib/ads/scaling";

describe("calculateProfit / calculateMargin", () => {
  it("profit og margin", () => {
    expect(calculateProfit({ revenue: 100, spend: 40 })).toBe(60);
    expect(calculateMargin({ revenue: 100, spend: 40 })).toBeCloseTo(0.6);
    expect(calculateMargin({ revenue: 0, spend: 10 })).toBe(0);
  });
});

describe("classifyProfit", () => {
  it("strong / weak / loss", () => {
    expect(classifyProfit({ revenue: 100, spend: 50 })).toBe("strong");
    expect(classifyProfit({ revenue: 100, spend: 80 })).toBe("weak");
    expect(classifyProfit({ revenue: 50, spend: 80 })).toBe("loss");
  });
});

describe("scaleCampaign", () => {
  it("øker kun når ROAS ≥ 2", () => {
    expect(scaleCampaign({ budget: 100, spend: 10, revenue: 25 })).toBe(115);
    expect(scaleCampaign({ budget: 100, spend: 10, revenue: 15 })).toBe(100);
  });
});

describe("cutLosses", () => {
  it("pause under 1, reduksjon under 1.5", () => {
    expect(cutLosses({ spend: 10, revenue: 5 })?.action).toBe("pause");
    expect(cutLosses({ spend: 10, revenue: 12 })?.action).toBe("reduce");
    expect(cutLosses({ spend: 10, revenue: 20 })).toBeNull();
  });
});

describe("enforceCaps", () => {
  it("klipper dagsbudsjett og fryser konto ved overforbruk", () => {
    const c = { budget: 9000 };
    expect(enforceCaps(c, { totalSpend: 10000 })).toBe("ok");
    expect(c.budget).toBe(guardrails.maxDailyBudget);
    const c2 = { budget: 1000 };
    expect(enforceCaps(c2, { totalSpend: 25000 })).toBe("freeze");
  });
});

describe("controlAccount", () => {
  it("freeze_all over grense", () => {
    expect(controlAccount([{ spend: 15000 }, { spend: 6000 }])).toBe("freeze_all");
    expect(controlAccount([{ spend: 1000 }])).toBe("ok");
  });
});

describe("decideAction", () => {
  it("matcher profit-klasse", () => {
    expect(decideAction({ revenue: 100, spend: 40 })).toBe("scale");
    expect(decideAction({ revenue: 100, spend: 80 })).toBe("hold");
    expect(decideAction({ revenue: 40, spend: 80 })).toBe("cut");
  });
});

describe("evaluateProfitFirstRow", () => {
  it("fail-closed ved ugyldige tall", () => {
    const r = evaluateProfitFirstRow(
      { name: "X", budget: NaN, spend: 0, revenue: 0 },
      { accountTotalSpend: 0, accountStatus: "ok" },
    );
    expect(r.executionHint).toBe("pause");
    expect(r.protectedCampaign).toBe(true);
  });

  it("blokkerer skalering under minROAS (sterk margin, men ROAS under 2)", () => {
    const r = evaluateProfitFirstRow(
      { name: "Y", budget: 1000, spend: 100, revenue: 170 },
      { accountTotalSpend: 100, accountStatus: "ok" },
    );
    expect(r.autonomyDecision).toBe("scale");
    expect(r.roas).toBeCloseTo(1.7);
    expect(r.executionHint).toBe("hold");
    expect(r.blockedReasons.some((x) => x.includes("minROAS"))).toBe(true);
  });

  it("kill-switch ved høy spend og lav ROAS", () => {
    const r = evaluateProfitFirstRow(
      { name: "Z", budget: 2000, spend: 600, revenue: 400 },
      { accountTotalSpend: 600, accountStatus: "ok" },
    );
    expect(r.killSwitchActive).toBe(true);
    expect(r.executionHint).toBe("pause");
  });
});

describe("evaluateProfitFirstAll", () => {
  it("returnerer profit summary", () => {
    const out = evaluateProfitFirstAll([
      { name: "A", budget: 100, spend: 10, revenue: 50 },
      { name: "B", budget: 100, spend: 10, revenue: 5 },
    ]);
    expect(out.rowResults).toHaveLength(2);
    expect(out.profitSummary.totalSpend).toBe(20);
    expect(out.profitSummary.totalRevenue).toBe(55);
  });
});
