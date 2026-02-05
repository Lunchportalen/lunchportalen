// tests/tenant-isolation.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

/* =========================================================
   Helpers
========================================================= */
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
   Mocks
========================================================= */

// scope: styr rolle og company via headers
vi.mock("@/lib/auth/scope", () => ({
  getScope: vi.fn(async (req: any) => {
    const h = (k: string) => safeStr(req?.headers?.get?.(k) ?? req?.headers?.[k]);
    return {
      userId: h("x-mock-user") || "u_test",
      role: h("x-mock-role") || null,
      companyId: h("x-mock-company") || null,
      locationId: h("x-mock-location") || null,
      email: h("x-mock-email") || "test@lunchportalen.no",
    };
  }),
}));

// company scope gate (scopeOr401 bruker respond + routeGuard)
vi.mock("@/lib/http/respond", async () => {
  return {
    makeRid: () => "rid_test",
    jsonErr: (rid: string, message: string, status = 400, error?: any) =>
      new Response(JSON.stringify({ ok: false, rid, message, status, error }), { status }),
    jsonOk: (rid: string, data: any, status = 200) =>
      new Response(JSON.stringify({ ok: true, rid, data }), { status }),
  };
});

// Supabase admin: returner orders som matcher company filter i route
let lastCompanyEq: string | null = null;
let lastDateEq: string | null = null;
let lastStatusEq: string | null = null;

function makeAdminDb() {
  return {
    from: (_table: string) => {
      const q: any = {
        select: (_s: string) => q,
        eq: (k: string, v: any) => {
          if (k === "company_id") lastCompanyEq = String(v ?? "");
          if (k === "date") lastDateEq = String(v ?? "");
          if (k === "status") lastStatusEq = String(v ?? "");
          return q;
        },
        order: () => q,
        then: (resolve: any) => {
          // Vi returnerer alltid samme rader, men testen sjekker at company_admin-låsing skjer i respons.
          resolve({
            data: [
              { id: "oA", company_id: "cA", date: "2026-01-29", status: "ACTIVE" },
              { id: "oB", company_id: "cB", date: "2026-01-29", status: "ACTIVE" },
            ],
            error: null,
          });
        },
      };
      return q;
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => makeAdminDb(),
}));

/* =========================================================
   Route under test
   (KORREKT STI FRA tests -> app/api)
========================================================= */
import { GET as adminOrdersGET } from "../app/api/admin/orders/route";

beforeEach(() => {
  lastCompanyEq = null;
  lastDateEq = null;
  lastStatusEq = null;
});

/* =========================================================
   Tests
========================================================= */
describe("tenant isolation – admin/orders", () => {
  test("company_admin: company_id i respons låses til scope.companyId (selv om query prøver annet)", async () => {
    const req = mkReq("http://localhost/api/admin/orders?date=2026-01-29&status=ACTIVE&company_id=cB", {
      method: "GET",
      headers: {
        "x-mock-role": "company_admin",
        "x-mock-company": "cA",
        "x-mock-user": "u_adminA",
      },
    });

    const res = await adminOrdersGET(req);
    expect(res.status).toBe(200);

    const json = await readJson(res);
    expect(json.ok).toBe(true);

    // ✅ fasit: route returnerer company_id som den faktisk bruker (scope-låst)
    expect(json.data?.company_id).toBe("cA");
    expect(String(json.data?.status)).toBe("ACTIVE");
    expect(String(json.data?.dateISO)).toBe("2026-01-29");
  });

  test("superadmin: company_id kan filtreres fritt via query", async () => {
    const req = mkReq("http://localhost/api/admin/orders?date=2026-01-29&status=ACTIVE&company_id=cB", {
      method: "GET",
      headers: {
        "x-mock-role": "superadmin",
        "x-mock-user": "u_sa",
        "x-mock-company": "", // irrelevant
      },
    });

    const res = await adminOrdersGET(req);
    expect(res.status).toBe(200);

    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.data?.company_id).toBe("cB"); // ✅ superadmin får velge
  });
});
