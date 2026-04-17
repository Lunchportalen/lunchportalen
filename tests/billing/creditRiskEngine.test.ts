import { describe, expect, test } from "vitest";

import { evaluateCreditRisk } from "@/lib/billing/creditRiskEngine";
import type { CompanyTripletexInvoiceStatus } from "@/lib/integrations/tripletexStatusEngine";

describe("creditRiskEngine", () => {
  test("UNKNOWN when no mapping / error sources", () => {
    expect(
      evaluateCreditRisk({
        source: "no_customer_mapping",
        status: "unknown",
        daysOverdue: 0,
        amountDue: 0,
      }),
    ).toBe("UNKNOWN");
    expect(
      evaluateCreditRisk({
        source: "tripletex_error",
        status: "unknown",
        daysOverdue: 0,
        amountDue: 0,
      }),
    ).toBe("UNKNOWN");
  });

  test("deterministic buckets from daysOverdue", () => {
    const base = (d: number, st: CompanyTripletexInvoiceStatus["status"]): CompanyTripletexInvoiceStatus => ({
      source: "tripletex",
      status: st,
      daysOverdue: d,
      amountDue: 1,
    });
    expect(evaluateCreditRisk(base(0, "ok"))).toBe("LOW");
    expect(evaluateCreditRisk(base(5, "overdue"))).toBe("MEDIUM");
    expect(evaluateCreditRisk(base(14, "overdue"))).toBe("HIGH");
    expect(evaluateCreditRisk(base(15, "overdue"))).toBe("HIGH");
    expect(evaluateCreditRisk(base(30, "severe_overdue"))).toBe("CRITICAL");
    expect(evaluateCreditRisk(base(31, "overdue"))).toBe("CRITICAL");
  });
});
