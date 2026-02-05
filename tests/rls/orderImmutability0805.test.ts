// tests/rls/orderImmutability0805.test.ts
// @ts-nocheck
import { describe, test, expect, vi } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers }) as any;
}
async function readJson(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t };
  }
}

vi.mock("@/lib/date/oslo", () => ({
  cutoffStatusForDate: (_d: string) => "TODAY_OPEN",
  cutoffStatusForDate0805: (_d: string) => "TODAY_LOCKED",
  osloNowISO: () => "2026-02-01T08:06:00",
}));

vi.mock("@/lib/agreement/requireRule", () => ({
  requireRule: vi.fn(async () => ({ ok: true, rule: { tier: "BASIS" } })),
}));

vi.mock("@/lib/orders/orderBackup", () => ({
  sendOrderBackup: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "u1", role: "employee", company_id: "c1", location_id: "l1", disabled_at: null },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "companies") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: "c1", status: "active" }, error: null }),
            }),
          }),
        };
      }
      if (table === "orders") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "o1",
                    user_id: "u1",
                    company_id: "c1",
                    location_id: "l1",
                    date: "2026-02-01",
                    status: "ACTIVE",
                    note: null,
                    slot: "lunch",
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    },
  }),
}));

import { POST as togglePOST } from "../../app/api/orders/[orderId]/toggle/route";

describe("E1 - order immutability after 08:05", () => {
  test("blocks toggle after 08:05 for current date", async () => {
    const req = mkReq("http://localhost/api/orders/o1/toggle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wantsLunch: true }),
    });

    const res = await togglePOST(req as any, { params: { orderId: "o1" } } as any);
    expect(res.status).toBe(423);

    const json = await readJson(res);
    expect(json.ok).toBe(false);
    expect(String(json.error)).toBe("LOCKED_AFTER_0805");
  });
});
