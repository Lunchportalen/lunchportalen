import { describe, expect, it } from "vitest";

import { summarizeAgreementScheduleForCms } from "@/lib/cms/backoffice/agreementScheduleAbbrev";

describe("agreementScheduleAbbrev", () => {
  it("returnerer plan og binding når agreement_json normaliseres (FORMAT A)", () => {
    const json = {
      commercial: { bindingMonths: 12, noticeMonths: 3 },
      tiers: {
        LUXUS: { label: "LUX", price: 130 },
      },
      schedule: {
        mon: { tier: "LUXUS" },
        tue: { tier: "LUXUS" },
        wed: { tier: "LUXUS" },
        thu: { tier: "LUXUS" },
        fri: { tier: "LUXUS" },
      },
    };
    const r = summarizeAgreementScheduleForCms(json);
    expect(r.ok).toBe(true);
    if (r.ok === true) {
      expect(r.bindingMonths).toBe(12);
      expect(r.noticeMonths).toBe(3);
      expect(r.dayTiers).toHaveLength(5);
      expect(r.dayTiers[0]?.tier).toBe("LUXUS");
    }
  });

  it("returnerer ok false for ugyldig json", () => {
    const r = summarizeAgreementScheduleForCms(null);
    expect(r.ok).toBe(false);
  });
});
