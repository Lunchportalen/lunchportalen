import { describe, expect, it } from "vitest";

import {
  assertEnterpriseContract,
  enterpriseEmployeeVisibility,
  enterpriseIsNotAutomaticLuxus,
} from "@/lib/enterprise/enterpriseContract";

const base = {
  contract_id: "ent-1",
  provider_id: "p1",
  company_id: "c1",
  country_code: "NO",
  currency: "NOK",
  base_price_minor: 17000,
  base_price_version: "v1",
  included_categories: ["warm_meal", "sandwich"] as const,
  included_upgrades: ["premium_side"] as const,
  paid_upgrades: [{ upgrade_key: "dessert" as const, price_minor: 2500, price_version: "u1" }],
  minimum_daily_quantity: 10,
  contractual_volume: 200,
  delivery_points: ["loc-1"],
  delivery_windows: ["11:00-12:00"],
  capacity: 120,
  cutoff: "08:00",
  operating_days: ["mon", "tue", "wed", "thu", "fri"],
  effective_from: "2026-07-01",
  effective_to: null,
  cost_centers: ["CC1"],
  reporting_needs: ["monthly"],
  version: "1",
  audit_event_id: "a1",
};

describe("enterpriseContract", () => {
  it("requires warm meal and is not automatic Luxus", () => {
    expect(() => assertEnterpriseContract({ ...base, included_categories: ["sandwich"] as any })).toThrow(
      /ENTERPRISE_MISSING_WARM_MEAL/,
    );
    expect(enterpriseIsNotAutomaticLuxus(base as any)).toBe(true);
  });

  it("shows included / paid upgrade / unavailable", () => {
    expect(enterpriseEmployeeVisibility(base as any, "warm_meal").visibility).toBe("included");
    expect(enterpriseEmployeeVisibility(base as any, "sandwich", "dessert").visibility).toBe("paid_upgrade");
    expect(enterpriseEmployeeVisibility(base as any, "sushi").visibility).toBe("unavailable");
  });
});
