import { describe, expect, it } from "vitest";

import {
  aggregateLocationCounts,
  summarizeAgreementJson,
} from "@/lib/cms/backoffice/domainRuntimeOverviewShared";

describe("domainRuntimeOverviewShared", () => {
  it("summarizeAgreementJson henter tier og admin e-post", () => {
    const j = {
      admin: { email: "a@firma.no" },
      meal_contract: { plan_tier: "LUXUS" },
    };
    const s = summarizeAgreementJson(j);
    expect(s.tierLabel).toBe("LUXUS");
    expect(s.adminEmail).toBe("a@firma.no");
  });

  it("aggregateLocationCounts teller per firma", () => {
    const m = aggregateLocationCounts([
      { company_id: "c1" },
      { company_id: "c1" },
      { company_id: "c2" },
    ]);
    expect(m.get("c1")).toBe(2);
    expect(m.get("c2")).toBe(1);
  });
});
