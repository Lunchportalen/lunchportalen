import { describe, expect, it } from "vitest";

import {
  aggregateLinesByCompany,
  isRunPeriodLocked,
  normalizeTripletexExportStatus,
  parseMonth,
  tripletexKey,
} from "@/lib/superadmin/invoiceMonthlyDb";

describe("invoiceMonthlyDb", () => {
  it("parseMonth returns month bounds", () => {
    const m = parseMonth("2026-02");
    expect(m?.monthStart).toBe("2026-02-01");
    expect(m?.monthEnd).toBe("2026-02-28");
    expect(m?.nextMonthStart).toBe("2026-03-01");
  });

  it("normalizeTripletexExportStatus maps prod statuses", () => {
    expect(normalizeTripletexExportStatus("EXPORTED")).toBe("EXPORTED");
    expect(normalizeTripletexExportStatus("FAILED")).toBe("FAILED");
    expect(normalizeTripletexExportStatus("PENDING")).toBe("PENDING_EXPORT");
  });

  it("aggregateLinesByCompany sums quantity and tracks line id reference", () => {
    const runsById = new Map([
      [
        "run-1",
        { id: "run-1", period_start: "2026-01-01", period_end: "2026-01-31", status: "READY" },
      ],
    ]);
    const txByKey = new Map([
      [
        tripletexKey("run-1", "co-1"),
        {
          id: "tx-1",
          run_id: "run-1",
          company_id: "co-1",
          external_invoice_id: null,
          status: "PENDING",
          last_error: null,
          updated_at: "2026-02-01T00:00:00Z",
        },
      ],
    ]);

    const agg = aggregateLinesByCompany(
      [
        {
          id: "line-1",
          company_id: "co-1",
          run_id: "run-1",
          quantity: 5,
          tier: "BASIS",
          unit_price_nok: 90,
          amount_nok: 450,
          service_date: "2026-01-15",
          description: "Lunsj",
        },
      ],
      runsById,
      txByKey,
    );

    expect(agg.get("co-1")?.qty).toBe(5);
    expect(agg.get("co-1")?.references).toEqual(["line-1"]);
    expect(isRunPeriodLocked("READY", null)).toBe(false);
    expect(isRunPeriodLocked("READY", "tx-99")).toBe(true);
  });
});
