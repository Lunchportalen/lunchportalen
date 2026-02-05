// tests/rls/orderAgreementRulesGate.test.ts
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

vi.mock("@/lib/http/routeGuard", async () => {
  const mod = await vi.importActual<any>("@/lib/http/routeGuard");
  return {
    ...mod,
    scopeOr401: vi.fn(async () => ({
      ok: true,
      ctx: {
        rid: "rid_rule",
        route: "/api/orders/toggle",
        method: "POST",
        scope: {
          userId: "u1",
          role: "employee",
          companyId: "c1",
          locationId: "l1",
          email: "test@lunchportalen.no",
        },
      },
    })),
    requireCompanyScopeOr403: vi.fn(() => null),
  };
});

let mockDeliveryDays: string[] = ["thu"];

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u_cookie" } }, error: null }) },
    from: () => ({
      upsert: () => ({
        select: () => ({
          maybeSingle: async () => ({ data: null, error: { message: "should_not_happen" } }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => {
          if (table === "companies") return { data: { id: "c1", status: "ACTIVE" }, error: null };
          if (table === "company_current_agreement") {
            return { data: { id: "ag1", company_id: "c1", status: "ACTIVE", delivery_days: mockDeliveryDays }, error: null };
          }
          if (table === "company_current_agreement_rules") return { data: null, error: null };
          return { data: null, error: null };
        },
      };
      return q;
    },
  }),
}));

vi.mock("@/lib/date/oslo", () => ({
  isIsoDate: (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? "")),
  cutoffStatusForDate: (_d: string) => "OPEN",
}));

vi.mock("@/lib/audit/auditWrite", () => ({
  auditWriteMust: vi.fn(async (_x: any) => ({})),
}));

vi.mock("@/lib/orders/orderBackup", () => ({
  sendOrderBackup: vi.fn(async () => ({ ok: true })),
}));

import { POST as togglePOST } from "../../app/api/orders/toggle/route";

describe("agreement rules gate - orders", () => {
  test("toggle PLACE returns 403 when day is not in delivery_days", async () => {
    mockDeliveryDays = ["mon"];
    const req = mkReq("http://localhost/api/orders/toggle", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mock-role": "employee",
        "x-mock-company": "c1",
        "x-mock-location": "l1",
        "x-mock-user": "u1",
      },
      body: JSON.stringify({ date: "2026-01-29", action: "place", slot: "lunch" }),
    });

    const res = await togglePOST(req);
    expect(res.status).toBe(403);

    const json = await readJson(res);
    expect(json.ok).toBe(false);
    expect(String(json.error)).toBe("AGREEMENT_DAY_NOT_DELIVERY");
  });

  test("toggle PLACE returns 403 when day_key is not in rules", async () => {
    mockDeliveryDays = ["thu"];
    const req = mkReq("http://localhost/api/orders/toggle", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mock-role": "employee",
        "x-mock-company": "c1",
        "x-mock-location": "l1",
        "x-mock-user": "u1",
      },
      body: JSON.stringify({ date: "2026-01-29", action: "place", slot: "lunch" }),
    });

    const res = await togglePOST(req);
    expect(res.status).toBe(403);

    const json = await readJson(res);
    expect(json.ok).toBe(false);
    expect(String(json.error)).toBe("AGREEMENT_RULE_MISSING");
  });
});
