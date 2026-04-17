import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/agreement/requireRule", () => ({
  requireRule: vi.fn(async () => ({
    ok: true as const,
    rule: {
      company_id: "c1",
      day_key: "mon",
      slot: "lunch",
      tier: "BASIS" as const,
    },
  })),
}));

const adminFrom = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ from: (...args: unknown[]) => adminFrom(...args) }),
}));

function mkRangeChain(rows: unknown[], err: { message: string } | null = null) {
  return {
    select: () => ({
      gte: () => ({
        lte: () => ({
          or: async () => ({ data: err ? null : rows, error: err }),
        }),
      }),
    }),
  };
}

describe("operative closed_dates (service_role) — preflight + range loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminFrom.mockImplementation((table: string) => {
      if (table !== "closed_dates") throw new Error(`unexpected admin table: ${table}`);
      return mkRangeChain([]);
    });
  });

  test("preflight returns CLOSED_DATE when range inkluderer stengt dato", async () => {
    adminFrom.mockImplementation((table: string) => {
      if (table !== "closed_dates") throw new Error(`unexpected admin table: ${table}`);
      return mkRangeChain([{ date: "2026-06-01", reason: "Operativ stengt" }]);
    });
    const { assertOrderWithinAgreementPreflight } = await import("@/lib/orders/orderWriteGuard");
    const r = await assertOrderWithinAgreementPreflight({
      sb: {} as any,
      companyId: "c1",
      locationId: "l1",
      orderIsoDate: "2026-06-01",
      agreementRuleSlot: "lunch",
      rid: "rid_t",
      action: "SET",
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.code).toBe("CLOSED_DATE");
      expect(r.status).toBe(409);
    }
  });

  test("preflight passes when ingen treff i intervall", async () => {
    const { assertOrderWithinAgreementPreflight } = await import("@/lib/orders/orderWriteGuard");
    const r = await assertOrderWithinAgreementPreflight({
      sb: {} as any,
      companyId: "c1",
      locationId: "l1",
      orderIsoDate: "2026-06-02",
      agreementRuleSlot: "lunch",
      rid: "rid_t",
      action: "CANCEL",
    });
    expect(r.ok).toBe(true);
  });

  test("loadOperativeClosedDatesReasonsInRange fail-closed ved lookup-feil", async () => {
    adminFrom.mockImplementation((table: string) => {
      if (table !== "closed_dates") throw new Error(`unexpected admin table: ${table}`);
      return mkRangeChain([], { message: "network" });
    });
    const { loadOperativeClosedDatesReasonsInRange } = await import("@/lib/orders/orderWriteGuard");
    const r = await loadOperativeClosedDatesReasonsInRange({
      companyId: "c1",
      locationId: null,
      fromIso: "2026-06-03",
      toIso: "2026-06-03",
      rid: "rid_t",
    });
    expect(r.ok).toBe(false);
  });
});
