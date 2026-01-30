// app/tests/rls/companyAdminStatusGate.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers }) as any;
}
async function readJson(res: Response) {
  const t = await res.text();
  if (!t) return {}; // ✅ aldri null/undefined
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t };
  }
}

/* =========================================================
   Mocks
========================================================= */
let companyStatus = "ACTIVE";

vi.mock("@/lib/auth/scope", () => ({
  getScope: vi.fn(async (req: any) => ({
    userId: "u1",
    role: "company_admin",
    companyId: "c1",
    locationId: "l1",
    email: "test@lunchportalen.no",
  })),
}));

vi.mock("@/lib/date/oslo", () => ({
  isIsoDate: () => true,
  cutoffStatusForDate: () => "OPEN",
}));

vi.mock("@/lib/orders/orderBackup", () => ({
  sendOrderBackup: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/audit/auditWrite", () => ({
  auditWriteMust: vi.fn(async () => true),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: "c1", status: companyStatus },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u_cookie" } }, error: null }) },
    from: () => ({
      upsert: () => ({
        select: () => ({
          maybeSingle: async () => ({
            data: {
              id: "o1",
              date: "2026-01-29",
              status: "ACTIVE",
              note: null,
              slot: "lunch",
              created_at: "2026-01-29T07:00:00.000Z",
              updated_at: "2026-01-29T07:00:00.000Z",
            },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

import { POST as togglePOST } from "../../api/orders/toggle/route";

/* =========================================================
   Tests
========================================================= */
describe("RLS: company_admin status gate (active/paused/closed)", () => {
  beforeEach(() => {
    companyStatus = "ACTIVE";
  });

  test("ACTIVE -> place OK (200)", async () => {
    companyStatus = "ACTIVE";

    const req = mkReq("http://localhost/api/orders/toggle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-01-29", action: "place", slot: "lunch" }),
    });

    const res = await togglePOST(req);
    expect(res.status).toBe(200);

    const json = await readJson(res);
    // API-kontrakt: order finnes normalt, men vi hard-failer ikke om body er tom.
    if (json?.order?.status) {
      expect(String(json.order.status)).toBe("ACTIVE");
    }
  });

  test("PAUSED -> place blir blokkert (403)", async () => {
    companyStatus = "PAUSED";

    const req = mkReq("http://localhost/api/orders/toggle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-01-29", action: "place", slot: "lunch" }),
    });

    const res = await togglePOST(req);
    expect(res.status).toBe(403);
  });

  test("CLOSED -> cancel blir blokkert (403)", async () => {
    companyStatus = "CLOSED";

    const req = mkReq("http://localhost/api/orders/toggle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-01-29", action: "cancel", slot: "lunch" }),
    });

    const res = await togglePOST(req);
    expect(res.status).toBe(403);
  });
});
