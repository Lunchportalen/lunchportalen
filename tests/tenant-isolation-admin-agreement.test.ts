// tests/tenant-isolation-admin-agreement.test.ts
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

const COMPANY_A = "cA";
const COMPANY_B = "cB";

vi.mock("@/lib/http/routeGuard", async () => {
  const mod = await vi.importActual<any>("@/lib/http/routeGuard");
  return {
    ...mod,
    scopeOr401: vi.fn(async () => ({
      ok: true,
      ctx: {
        rid: "rid_test",
        route: "/api/admin/agreement",
        method: "GET",
        scope: {
          userId: "u1",
          role: "company_admin",
          companyId: COMPANY_A,
          locationId: "lA",
          email: "user@lunchportalen.no",
        },
      },
    })),
  };
});

vi.mock("@/lib/date/oslo", () => ({
  osloTodayISODate: () => "2026-02-02",
  OSLO_TZ: "Europe/Oslo",
}));

function makeAdminMock(seed?: any) {
  const eqCalls: Array<{ table: string; key: string; value: string }> = [];

  function makeQuery(table: string) {
    const q: any = {
      _table: table,
      _count: false,
      _disabledFilter: null as null | "active" | "disabled",
      select: (_cols?: any, opts?: any) => {
        q._count = Boolean(opts?.count);
        return q;
      },
      eq: (k: string, v: any) => {
        eqCalls.push({ table, key: k, value: String(v ?? "") });
        return q;
      },
      is: (k: string, v: any) => {
        if (k === "disabled_at" && v === null) q._disabledFilter = "active";
        return q;
      },
      not: (k: string, _op: string, v: any) => {
        if (k === "disabled_at" && v === null) q._disabledFilter = "disabled";
        return q;
      },
      gte: () => q,
      lte: () => q,
      maybeSingle: async () => {
        if (table === "companies") return { data: seed?.company ?? { id: COMPANY_A, name: "A", status: "ACTIVE" }, error: null };
        if (table === "company_current_agreement") return { data: seed?.agreement ?? { id: "agA", company_id: COMPANY_A, status: "ACTIVE", delivery_days: ["mon"] }, error: null };
        if (table === "company_locations") return { data: seed?.location ?? { id: "lA", name: "LocA", company_id: COMPANY_A }, error: null };
        return { data: null, error: null };
      },
      then: (resolve: any) => {
        if (q._count) {
          if (table === "profiles") {
            const base = seed?.counts ?? { total: 5, active: 4, disabled: 1 };
            const count =
              q._disabledFilter === "active"
                ? base.active
                : q._disabledFilter === "disabled"
                  ? base.disabled
                  : base.total;
            return resolve({ count, error: null });
          }
          if (table === "orders") {
            return resolve({ count: seed?.ordersToday ?? 2, error: null });
          }
        }

        if (table === "orders") {
          const rows = seed?.cancelledOrders ?? [
            { date: "2026-02-02", status: "CANCELLED", cancelled_at: "2026-02-02T07:00:00Z", updated_at: null, created_at: null },
          ];
          return resolve({ data: rows, error: null });
        }

        return resolve({ data: [], error: null });
      },
    };
    return q;
  }

  return { admin: { from: (table: string) => makeQuery(table) }, eqCalls };
}

vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin")>();
  const mock = makeAdminMock();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,
    supabaseAdmin: () => mock.admin,
    __mock: mock,
  };
});

import { GET as agreementGET } from "../app/api/admin/agreement/route";
import { __mock as adminMock } from "@/lib/supabase/admin";

beforeEach(() => {
  vi.clearAllMocks();
  adminMock.eqCalls.length = 0;
});

describe("tenant isolation - admin agreement", () => {
  test("company_admin ignores client companyId and uses scope", async () => {
    const req = mkReq(`http://localhost/api/admin/agreement?companyId=${COMPANY_B}`, { method: "GET" });
    const res = await agreementGET(req);
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.company.id).toBe(COMPANY_A);

    const agreementFilter = adminMock.eqCalls.find((c: any) => c.table === "company_current_agreement" && c.key === "company_id");
    expect(agreementFilter?.value).toBe(COMPANY_A);
  });

  test("scale sanity: queries include company_id filters", async () => {
    const req = mkReq("http://localhost/api/admin/agreement", { method: "GET" });
    const res = await agreementGET(req);
    expect(res.status).toBe(200);

    const tables = adminMock.eqCalls.map((c: any) => `${c.table}:${c.key}:${c.value}`);
    const hasAgreement = tables.some((t: string) => t === `company_current_agreement:company_id:${COMPANY_A}`);
    const hasProfiles = tables.some((t: string) => t === `profiles:company_id:${COMPANY_A}`);
    const hasOrders = tables.some((t: string) => t === `orders:company_id:${COMPANY_A}`);

    expect(hasAgreement).toBe(true);
    expect(hasProfiles).toBe(true);
    expect(hasOrders).toBe(true);
  });
});
