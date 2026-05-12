import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { tierChoiceLimit } from "@/app/(app)/week/EmployeeWeekClient";
import { PRICE_PER_TIER, type PlanTier } from "@/lib/pricing/priceForDate";

describe("agreement tier ENTERPRISE contract", () => {
  it("includes ENTERPRISE in the TypeScript plan tier union", () => {
    const tier: PlanTier = "ENTERPRISE";
    expect(tier).toBe("ENTERPRISE");
  });

  it("gives ENTERPRISE the same choice capacity as LUXUS", () => {
    expect(tierChoiceLimit("ENTERPRISE")).toBe(6);
  });

  it("prices ENTERPRISE at 170 NOK ex VAT", () => {
    expect(PRICE_PER_TIER.ENTERPRISE).toBe(170);
  });
});
