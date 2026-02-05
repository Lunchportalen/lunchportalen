// tests/kitchen/cutoff.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { isAfterCutoff0800 } from "../lib/kitchen/cutoff";
import { fetchKitchenDayData } from "../lib/kitchen/dayData";

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
        id: "o1",
        user_id: "u1",
        company_id: "cA",
        location_id: "l1",
        date: "2026-02-01",
        note: null,
        created_at: "2026-02-01T06:30:00.000Z",
        status: "ACTIVE",
        integrity_status: "ok",
        slot: "lunch",
      },
      {
        id: "o2",
        user_id: "u2",
        company_id: "cA",
        location_id: "l1",
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
      companyId: "cA",
      locationId: "l1",
      slot: "lunch",
      rid: "rid_cutoff",
      cutoffAtUTCISO: cutoffAt,
      afterCutoff: true,
    });

    const total = groups.reduce((sum, g) => sum + (g.orders?.length ?? 0), 0);
    expect(total).toBe(1);
  });
});
