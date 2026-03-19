// tests/rls/ordersLifecycleGate.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

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
function safeStr(v: any) {
  return String(v ?? "").trim();
}

/* =========================================================
   Mocks – vi tester KUN at enforcement gir 403 (ikke audit)
========================================================= */
vi.mock("@/lib/http/routeGuard", () => {
  const mkScope = (req: any) => {
    const h = (k: string) => safeStr(req?.headers?.get?.(k) ?? req?.headers?.[k]);
    return {
      userId: h("x-mock-user") || "u1",
      role: h("x-mock-role") || "employee",
      companyId: h("x-mock-company") || "c1",
      locationId: h("x-mock-location") || "l1",
      email: "test@lunchportalen.no",
    };
  };

  return {
    scopeOr401: vi.fn(async (req: any) => ({
      ok: true as const,
      ctx: {
        rid: "rid_test",
        route: "/api/orders/toggle",
        method: "POST",
        scope: mkScope(req),
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
  };
});

// supabaseServer: irrelevant når vi blokkerer tidlig
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

// admin status lookup
let companyStatus = "PAUSED";
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

// oslo time gates: OPEN
vi.mock("@/lib/date/oslo", () => ({
  isIsoDate: (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? "")),
  cutoffStatusForDate: (_d: string) => "OPEN",
}));

// audit: kan feile – men enforcement skal fortsatt gi 403
vi.mock("@/lib/audit/auditWrite", () => ({
  auditWriteMust: vi.fn(async (_x: any) => {
    throw new Error("audit down");
  }),
}));

// backup: unused i enforcement
vi.mock("@/lib/orders/orderBackup", () => ({
  sendOrderBackup: vi.fn(async () => ({ ok: true })),
}));

import { POST as togglePOST } from "../../app/api/orders/toggle/route";

describe("D1 – Orders lifecycle gate + minimum audit", () => {
  beforeEach(() => {
    companyStatus = "PAUSED";
  });

  test("PAUSED: toggle CANCEL skal være 403 selv om audit feiler", async () => {
    companyStatus = "PAUSED";

    const req = mkReq("http://localhost/api/orders/toggle", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mock-role": "employee",
        "x-mock-company": "c1",
        "x-mock-location": "l1",
        "x-mock-user": "u1",
      },
      body: JSON.stringify({ date: "2026-01-29", action: "cancel", slot: "lunch" }),
    });

    const res = await togglePOST(req);
    expect(res.status).toBe(403);

    const json = await readJson(res);
    expect(json.ok).toBe(false);
    expect(String(json.error)).toBe("COMPANY_PAUSED");
  });

  test("CLOSED: toggle PLACE skal være 403 selv om audit feiler", async () => {
    companyStatus = "CLOSED";

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
    expect(String(json.error)).toBe("COMPANY_CLOSED");
  });
});
