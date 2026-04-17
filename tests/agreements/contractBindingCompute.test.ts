import { describe, it, expect } from "vitest";
import {
  effectiveBindingEndIso,
  wholeMonthsBetweenInclusive,
  buildContractOverviewFromLedger,
  pickBestAgreementLedgerRow,
} from "@/lib/agreements/contractBindingCompute";

describe("contractBindingCompute", () => {
  it("effectiveBindingEndIso uses end_date when set", () => {
    expect(effectiveBindingEndIso("2026-01-01", "2026-12-31", 12)).toBe("2026-12-31");
  });

  it("effectiveBindingEndIso adds binding months when end missing", () => {
    expect(effectiveBindingEndIso("2026-01-01", null, 12)).toBe("2027-01-01");
  });

  it("wholeMonthsBetweenInclusive counts calendar months", () => {
    expect(wholeMonthsBetweenInclusive("2026-06-15", "2026-08-14")).toBe(1);
    expect(wholeMonthsBetweenInclusive("2026-01-01", "2026-03-01")).toBe(2);
  });

  it("TERMINATED yields 0 remaining months", () => {
    const o = buildContractOverviewFromLedger(
      {
        id: "a1",
        status: "TERMINATED",
        start_date: "2026-01-01",
        end_date: "2027-01-01",
        binding_months: 12,
        notice_months: 3,
      },
      "2026-06-01"
    );
    expect(o?.binding_months_remaining).toBe(0);
  });

  it("pickBestAgreementLedgerRow prioriterer ACTIVE og nyeste updated_at", () => {
    const best = pickBestAgreementLedgerRow([
      { id: "p", status: "PENDING", updated_at: "2026-01-01T00:00:00Z" },
      { id: "a", status: "ACTIVE", updated_at: "2025-12-01T00:00:00Z" },
      { id: "a2", status: "ACTIVE", updated_at: "2026-02-01T00:00:00Z" },
    ]);
    expect(best?.id).toBe("a2");
  });
});
