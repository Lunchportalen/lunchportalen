import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadOperativeKitchenOrders } from "@/lib/server/kitchen/loadOperativeKitchenOrders";
import { loadProductionReadiness } from "@/lib/server/superadmin/loadProductionReadiness";

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/server/kitchen/loadOperativeKitchenOrders", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/kitchen/loadOperativeKitchenOrders")>();
  return {
    ...actual,
    loadOperativeKitchenOrders: vi.fn(),
  };
});

/** Onsdag (ikke helg etter Europe/Oslo week-end i isWeekendOslo). */
const DATE = "2026-06-03";

function globalClosedChain(result: { data: unknown[]; error: unknown | null }) {
  return {
    select: () => ({
      eq: () => ({
        is: () => ({
          is: () => ({
            limit: () => Promise.resolve(result),
          }),
        }),
      }),
    }),
  };
}

function scopedClosedChain(result: { data: unknown[]; error: unknown | null }) {
  return {
    select: () => ({
      eq: () => ({
        or: () => ({
          limit: () => Promise.resolve(result),
        }),
      }),
    }),
  };
}

function outboxLikeChain(result: { data: unknown[]; error: unknown | null }) {
  return {
    select: () => ({
      like: () => ({
        limit: () => Promise.resolve(result),
      }),
    }),
  };
}

describe("loadProductionReadiness — closed_dates (operative schema)", () => {
  beforeEach(() => {
    vi.mocked(supabaseAdmin).mockReset();
    vi.mocked(loadOperativeKitchenOrders).mockReset();
  });

  it("Scenario 1: global closed_date (both scope ids null) → BLOCKED_GLOBAL_CLOSED", async () => {
    vi.mocked(supabaseAdmin).mockReturnValue({
      from: (table: string) => {
        if (table === "closed_dates") return globalClosedChain({ data: [{ reason: "Nasjonal fridag" }], error: null });
        throw new Error(`unexpected table ${table}`);
      },
    } as any);

    const p = await loadProductionReadiness(DATE);
    expect(p.level).toBe("BLOCKED_GLOBAL_CLOSED");
    expect(p.headline).toContain("global");
    expect(p.global_closed_reason).toBe("Nasjonal fridag");
    expect(loadOperativeKitchenOrders).not.toHaveBeenCalled();
  });

  it("Scenario 2: company-scoped closed_date for operative company → READY_WITH_WARNINGS og tekst om stengt", async () => {
    let closedRound = 0;
    vi.mocked(supabaseAdmin).mockReturnValue({
      from: (table: string) => {
        if (table === "closed_dates") {
          closedRound += 1;
          if (closedRound === 1) return globalClosedChain({ data: [], error: null });
          return scopedClosedChain({ data: [{ reason: "Bedriftspause" }], error: null });
        }
        if (table === "outbox") {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: [{ event_key: "order:set:33333333-3333-4333-8333-333333333333:2026-06-03:lunch" }],
                  error: null,
                }),
              like: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as any);

    const row = {
      id: "o1",
      user_id: "33333333-3333-4333-8333-333333333333",
      company_id: "11111111-1111-4111-8111-111111111111",
      location_id: "22222222-2222-4222-8222-222222222222",
      note: null,
      status: "ACTIVE",
      slot: "lunch",
    };

    vi.mocked(loadOperativeKitchenOrders).mockResolvedValue({
      ok: true,
      raw: [row],
      list0: [row],
      operative: [row],
      dcMap: new Map(),
    });

    const p = await loadProductionReadiness(DATE);
    expect(p.level).toBe("READY_WITH_WARNINGS");
    expect(p.detail).toContain("Bedriftspause");
    expect(p.detail).toContain("Stengt for operative firma");
    expect(p.operative_orders).toBe(1);
  });

  it("Scenario 3: ingen closed_dates, ingen operative ordre → READY", async () => {
    vi.mocked(supabaseAdmin).mockReturnValue({
      from: (table: string) => {
        if (table === "closed_dates") return globalClosedChain({ data: [], error: null });
        if (table === "outbox") return outboxLikeChain({ data: [], error: null });
        throw new Error(`unexpected table ${table}`);
      },
    } as any);

    vi.mocked(loadOperativeKitchenOrders).mockResolvedValue({
      ok: true,
      raw: [],
      list0: [],
      operative: [],
      dcMap: new Map(),
    });

    const p = await loadProductionReadiness(DATE);
    expect(p.level).toBe("READY");
    expect(p.global_closed_reason).toBeNull();
    expect(p.detail).toContain("Ingen registrerte avvik");
  });
});
