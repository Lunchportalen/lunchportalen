import { describe, expect, test } from "vitest";

import { biweeklyInvoiceWindowFromToday } from "@/lib/billing/invoiceEngine";
import { addDaysISO } from "@/lib/date/oslo";

describe("invoiceEngine window", () => {
  test("14-day window ends today (Oslo) and start is 14 days prior", () => {
    const w = biweeklyInvoiceWindowFromToday();
    expect(w.periodEndExclusive).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(w.periodStart).toBe(addDaysISO(w.periodEndExclusive, -14));
  });
});
