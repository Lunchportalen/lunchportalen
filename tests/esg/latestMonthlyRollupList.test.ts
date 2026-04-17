import { describe, expect, it } from "vitest";

import {
  loadLatestMonthlyRollupForCompany,
  loadLatestMonthlyRollupList,
} from "@/lib/esg/latestMonthlyRollupList";

function makeAdmin(options: {
  latestMonth?: string;
  canonicalRows?: Record<string, unknown>[];
  legacyRows?: Record<string, unknown>[];
  companies?: Record<string, unknown>[];
  canonicalError?: { code?: string; message: string } | null;
}) {
  return {
    from(table: string) {
      const state: {
        columns: string;
        companyId: string | null;
      } = {
        columns: "",
        companyId: null,
      };

      const query = {
        select(columns: string) {
          state.columns = columns;
          return query;
        },
        eq(column: string, value: string) {
          if (column === "company_id") state.companyId = value;
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        maybeSingle() {
          if (table === "esg_monthly" && state.columns === "month") {
            return Promise.resolve({
              data: options.latestMonth ? { month: options.latestMonth } : null,
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
        in(column: string, values: string[]) {
          if (table === "companies") {
            return Promise.resolve({
              data: (options.companies ?? []).filter((entry) => values.includes(String(entry.id ?? ""))),
              error: null,
            });
          }

          if (table !== "esg_monthly" || column !== "month") {
            return Promise.resolve({ data: [], error: null });
          }

          if (state.columns.includes("delivered_count")) {
            if (options.canonicalError) {
              return Promise.resolve({ data: null, error: options.canonicalError });
            }
            const filtered = (options.canonicalRows ?? []).filter((row) => {
              const month = String(row.month ?? "");
              const companyOk = state.companyId ? String(row.company_id ?? "") === state.companyId : true;
              return companyOk && values.includes(month);
            });
            return Promise.resolve({ data: filtered, error: null });
          }

          if (state.columns.includes("delivered_meals")) {
            const filtered = (options.legacyRows ?? []).filter((row) => {
              const month = String(row.month ?? "");
              const companyOk = state.companyId ? String(row.company_id ?? "") === state.companyId : true;
              return companyOk && values.includes(month);
            });
            return Promise.resolve({ data: filtered, error: null });
          }

          return Promise.resolve({ data: [], error: null });
        },
      };

      return query;
    },
  } as any;
}

describe("latestMonthlyRollupList", () => {
  it("returns canonical count baseline when esg_monthly already uses delivered_count columns", async () => {
    const admin = makeAdmin({
      latestMonth: "2026-02-01",
      canonicalRows: [
        {
          company_id: "c1",
          month: "2026-02",
          delivered_count: 120,
          cancelled_count: 4,
          delivery_rate: 96.8,
          waste_estimate_kg: 1.2,
          co2_estimate_kg: 8.4,
        },
      ],
      companies: [{ id: "c1", name: "Acme" }],
    });

    const result = await loadLatestMonthlyRollupList(admin, "");

    expect(result.month).toBe("2026-02");
    expect(result.baseline.status).toBe("ready");
    expect(result.baseline.degraded).toBe(false);
    expect(result.items[0]?.company.name).toBe("Acme");
    expect(result.items[0]?.delivered_count).toBe(120);
  });

  it("falls back to legacy meal columns and normalizes them to canonical counts", async () => {
    const admin = makeAdmin({
      latestMonth: "2026-02-01",
      canonicalError: {
        code: "42703",
        message: 'column "delivered_count" does not exist',
      },
      legacyRows: [
        {
          company_id: "c2",
          month: "2026-02-01",
          delivered_meals: 88,
          canceled_meals: 5,
          delivery_rate: 94.6,
          waste_estimate_kg: 0.8,
          co2_estimate_kg: 6.1,
          generated_at: "2026-02-29T08:00:00.000Z",
        },
      ],
      companies: [{ id: "c2", name: "Legacy Co" }],
    });

    const list = await loadLatestMonthlyRollupList(admin, "");
    const company = await loadLatestMonthlyRollupForCompany(admin, "c2", "");

    expect(list.baseline.status).toBe("legacy_column_fallback");
    expect(list.baseline.degraded).toBe(true);
    expect(list.items[0]?.delivered_count).toBe(88);
    expect(list.items[0]?.cancelled_count).toBe(5);
    expect(company.record?.delivered_count).toBe(88);
    expect(company.baseline.operatorAction).toContain("delivered_count/cancelled_count");
  });

  it("degrades honestly when ESG source queries fail for reasons other than legacy columns", async () => {
    const admin = makeAdmin({
      latestMonth: "2026-02-01",
      canonicalError: {
        code: "42501",
        message: "permission denied for table esg_monthly",
      },
    });

    const list = await loadLatestMonthlyRollupList(admin, "");
    const company = await loadLatestMonthlyRollupForCompany(admin, "c9", "2026-02");

    expect(list.month).toBe("2026-02");
    expect(list.items).toEqual([]);
    expect(list.baseline.status).toBe("query_failed");
    expect(list.baseline.degraded).toBe(true);
    expect(list.baseline.detail).toContain("permission denied");

    expect(company.record).toBeNull();
    expect(company.baseline.status).toBe("query_failed");
    expect(company.baseline.operatorAction).toContain("esg_monthly");
  });
});
