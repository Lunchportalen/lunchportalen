// tests/kitchen/cutoff.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { isAfterCutoff0800 } from "../lib/kitchen/cutoff";
import { fetchKitchenDayData } from "../lib/kitchen/dayData";

const C_CUT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const L_CUT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const U_CUT1 = "11111111-1111-4111-8111-111111111111";
const U_CUT2 = "22222222-2222-4222-8222-222222222222";
const O_CUT1 = "00000001-0001-4001-8001-000000000001";
const O_CUT2 = "00000002-0002-4002-8002-000000000002";

describe("kitchen cutoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("isAfterCutoff0800: before and after 08:00 Oslo", () => {
    vi.setSystemTime(new Date("2026-02-01T06:50:00.000Z")); // 07:50 Oslo
    const before = isAfterCutoff0800("2026-02-01");
    expect(before.after).toBe(false);

    vi.setSystemTime(new Date("2026-02-01T07:10:00.000Z")); // 08:10 Oslo
    const after = isAfterCutoff0800("2026-02-01");
    expect(after.after).toBe(true);
  });
});

describe("kitchen determinism – cutoff filter", () => {
  test("orders after cutoff are excluded when afterCutoff=true", async () => {
    const orders = [
      {
        id: O_CUT1,
        user_id: U_CUT1,
        company_id: C_CUT,
        location_id: L_CUT,
        date: "2026-02-01",
        note: null,
        created_at: "2026-02-01T06:30:00.000Z",
        status: "ACTIVE",
        integrity_status: "ok",
        slot: "lunch",
      },
      {
        id: O_CUT2,
        user_id: U_CUT2,
        company_id: C_CUT,
        location_id: L_CUT,
        date: "2026-02-01",
        note: null,
        created_at: "2026-02-01T07:30:00.000Z",
        status: "ACTIVE",
        integrity_status: "ok",
        slot: "lunch",
      },
    ];

    const admin = {
      from: (_table: string) => {
        let rows = orders.slice();
        const q: any = {
          select: () => q,
          eq: (k: string, v: any) => {
            rows = rows.filter((r: any) => String(r[k] ?? "") === String(v ?? ""));
            return q;
          },
          in: (k: string, vals: any[]) => {
            rows = rows.filter((r: any) => vals.includes(r[k]));
            return q;
          },
          lte: (k: string, v: any) => {
            rows = rows.filter((r: any) => String(r[k] ?? "") <= String(v ?? ""));
            return q;
          },
          order: () => q,
          then: (resolve: any) => resolve({ data: rows, error: null }),
        };
        return q;
      },
    };

    const cutoffAt = "2026-02-01T07:00:00.000Z";
    const { groups } = await fetchKitchenDayData({
      admin,
      dateISO: "2026-02-01",
      companyId: C_CUT,
      locationId: L_CUT,
      slot: "lunch",
      rid: "rid_cutoff",
      cutoffAtUTCISO: cutoffAt,
      afterCutoff: true,
    });

    const total = groups.reduce((sum, g) => sum + (g.orders?.length ?? 0), 0);
    expect(total).toBe(1);
  });
});
