// tests/rls/orderAgreementRulesGate.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers }) as any;
}
async function readJson(res: Response) {
  const t = await res.text();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t };
  }
}

/* =========================================================
   Mocks: Scope + date + audit + backup
========================================================= */

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: vi.fn(async () => ({
    ok: true as const,
    ctx: {
      rid: "rid_test",
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
  requireRoleOr403: vi.fn(() => null),
  requireCompanyScopeOr403: vi.fn(() => null),
  readJson: vi.fn(async (req: any) => {
    try {
      return await req.json();
    } catch {
      try {
        const raw = await req.text();
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }
  }),
}));

vi.mock("@/lib/date/oslo", () => ({
  isIsoDate: (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? "")),
  cutoffStatusForDate: (_d: string) => "OPEN",
  osloNowISO: () => "2026-01-29T07:00:00.000Z",
}));

vi.mock("@/lib/audit/auditWrite", () => ({
  auditWriteMust: vi.fn(async () => true),
}));

vi.mock("@/lib/orders/orderBackup", () => ({
  sendOrderBackup: vi.fn(async () => ({ ok: true })),
}));

/* =========================================================
   Mocks: Company status (ACTIVE) + Server write should not be hit
========================================================= */

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => {
          if (table === "companies") return { data: { id: "c1", status: "ACTIVE" }, error: null };
          return { data: null, error: null };
        },
      };
      return q;
    },
  }),
}));

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

/* =========================================================
   Mocks: Agreement rules gate (this is what toggle uses)
========================================================= */

type RuleResult =
  | { ok: true; rule?: any }
  | { ok: false; status: number; error: string; message?: string };

let mockDeliveryDays: string[] = ["thu"];
let mockRulesExist = true;

vi.mock("@/lib/agreement/requireRule", () => ({
  requireRule: vi.fn(async (_args: any): Promise<RuleResult> => {
    // Case 1: day not in delivery_days => 403 AGREEMENT_DAY_NOT_DELIVERY
    // In test we simulate by setting mockDeliveryDays to ["mon"] but date is Thu (2026-01-29).
    // So: if delivery days does not include "thu" => block.
    if (!mockDeliveryDays.includes("thu")) {
      return { ok: false, status: 403, error: "AGREEMENT_DAY_NOT_DELIVERY", message: "Day not in delivery_days" };
    }

    // Case 2: day is allowed but rule missing => 403 AGREEMENT_RULE_MISSING
    if (!mockRulesExist) {
      return { ok: false, status: 403, error: "AGREEMENT_RULE_MISSING", message: "Rule missing" };
    }

    return { ok: true, rule: { tier: "BASIS" } };
  }),
}));

import { POST as togglePOST } from "../../app/api/orders/toggle/route";

/* =========================================================
   Tests
========================================================= */

describe("agreement rules gate - orders", () => {
  beforeEach(() => {
    mockDeliveryDays = ["thu"];
    mockRulesExist = true;
  });

  test("toggle PLACE returns 403 when day is not in delivery_days", async () => {
    mockDeliveryDays = ["mon"]; // does NOT include "thu" -> should block
    mockRulesExist = true;

    const req = mkReq("http://localhost/api/orders/toggle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-01-29", action: "place", slot: "lunch" }),
    });

    const res = await togglePOST(req);
    expect(res.status).toBe(403);

    const json = await readJson(res);
    expect(json.ok).toBe(false);
    expect(String(json.error)).toBe("AGREEMENT_DAY_NOT_DELIVERY");
  });

  test("toggle PLACE returns 403 when day_key is not in rules", async () => {
    mockDeliveryDays = ["thu"]; // allowed day
    mockRulesExist = false;     // but missing rule -> should block

    const req = mkReq("http://localhost/api/orders/toggle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-01-29", action: "place", slot: "lunch" }),
    });

    const res = await togglePOST(req);
    expect(res.status).toBe(403);

    const json = await readJson(res);
    expect(json.ok).toBe(false);
    expect(String(json.error)).toBe("AGREEMENT_RULE_MISSING");
  });
});
