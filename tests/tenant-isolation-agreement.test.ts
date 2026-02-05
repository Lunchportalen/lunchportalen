// tests/tenant-isolation-agreement.test.ts
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

/* =========================================================
   Mocks: scope + sanity + agreement state
========================================================= */
vi.mock("@/lib/http/routeGuard", async () => {
  const mod = await vi.importActual<any>("@/lib/http/routeGuard");
  return {
    ...mod,
    scopeOr401: vi.fn(async () => ({
      ok: true,
      ctx: {
        rid: "rid_test",
        route: "/api/order/window",
        method: "GET",
        scope: {
          userId: "u1",
          role: "employee",
          companyId: "cA",
          locationId: "lA",
          email: "user@lunchportalen.no",
        },
      },
    })),
  };
});

vi.mock("@/lib/sanity/queries", () => ({
  getMenuForRange: vi.fn(async () => []),
}));

vi.mock("@/lib/agreement/currentAgreement", () => ({
  getCurrentAgreementState: vi.fn(async () => ({
    ok: true,
    companyId: "cA",
    locationId: "lA",
    status: "ACTIVE",
    planTier: null,
    pricePerCuvertNok: 95,
    deliveryDays: ["mon", "tue", "wed"],
    slot: "lunch",
    dayTiers: { mon: "BASIS", wed: "LUXUS" },
    basisDays: 1,
    luxusDays: 1,
    startDate: "2026-01-01",
    endDate: null,
    updatedAt: "2026-01-31T12:00:00Z",
    agreementId: "ag_a",
  })),
}));

vi.mock("@/lib/date/oslo", () => ({
  osloTodayISODate: () => "2026-02-02",
  addDaysISO: (iso: string, days: number) => {
    const d = new Date(`${iso}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + days);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const da = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  },
  isIsoDate: (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? "")),
  cutoffStatusForDate: (_d: string) => "OPEN",
}));

/* =========================================================
   Supabase mocks (service + server)
========================================================= */
function makeServiceClient() {
  return {
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => {
          if (table === "companies") {
            return { data: { id: "cA", status: "ACTIVE" }, error: null };
          }
          if (table === "company_current_agreement") {
            return { data: { id: "ag_a", company_id: "cA", status: "ACTIVE" }, error: null };
          }
          return { data: null, error: null };
        },
      };
      return q;
    },
  };
}

function makeServerClient() {
  return {
    from: (_table: string) => {
      const q: any = {
        select: () => q,
        eq: () => q,
        in: () => q,
        then: (resolve: any) => resolve({ data: [], error: null }),
      };
      return q;
    },
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => makeServiceClient(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => makeServerClient(),
}));

/* =========================================================
   Import route under test
========================================================= */
import { GET as orderWindowGET } from "../app/api/order/window/route";
import { getCurrentAgreementState } from "@/lib/agreement/currentAgreement";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tenant isolation – agreement + kitchen", () => {
  test("week gating uses day_tiers (active days only)", async () => {
    const req = mkReq("http://localhost/api/order/window?weeks=2", { method: "GET" });
    const res = await orderWindowGET(req);
    expect(res.status).toBe(200);

    const json = await readJson(res);
    expect(json.ok).toBe(true);

    const days = json.data?.days ?? [];
    const mon = days.find((d: any) => d.weekday === "mon");
    const tue = days.find((d: any) => d.weekday === "tue");
    const wed = days.find((d: any) => d.weekday === "wed");

    expect(mon?.isEnabled).toBe(true);
    expect(mon?.tier).toBe("BASIS");
    expect(tue?.isEnabled).toBe(false);
    expect(wed?.isEnabled).toBe(true);
    expect(wed?.tier).toBe("LUXUS");
  });

  test("employee never sees agreement from another company", async () => {
    (getCurrentAgreementState as any).mockResolvedValueOnce({
      ok: true,
      companyId: "cB",
      locationId: "lB",
      status: "ACTIVE",
      planTier: null,
      pricePerCuvertNok: 95,
      deliveryDays: ["mon"],
      slot: "lunch",
      dayTiers: { mon: "BASIS" },
      basisDays: 1,
      luxusDays: 0,
      startDate: "2026-01-01",
      endDate: null,
      updatedAt: "2026-01-31T12:00:00Z",
      agreementId: "ag_b",
    });

    const req = mkReq("http://localhost/api/order/window?weeks=2", { method: "GET" });
    const res = await orderWindowGET(req);
    const json = await readJson(res);

    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
    expect(json.error).toBe("AGREEMENT_SCOPE_MISMATCH");
  });
});

/* =========================================================
   Kitchen helper tests
========================================================= */
import { fetchKitchenDayData } from "../lib/kitchen/dayData";

function makeKitchenAdminStub() {
  const filters: Record<string, string | null> = {
    company_id: null,
    location_id: null,
  };

  return {
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: (k: string, v: any) => {
          if (k in filters) filters[k] = String(v ?? "");
          return q;
        },
        in: () => q,
        order: () => q,
        then: (resolve: any) => resolve({ data: [], error: null }),
      };

      if (table === "orders") {
        q.then = (resolve: any) => {
          const rows = [
            {
              id: "o1",
              user_id: "u1",
              company_id: "cA",
              location_id: "lX",
              date: "2026-02-01",
              note: null,
              created_at: "2026-02-01T07:00:00Z",
              status: "ACTIVE",
              slot: "lunch",
            },
            {
              id: "o2",
              user_id: "u2",
              company_id: "cB",
              location_id: "lX",
              date: "2026-02-01",
              note: null,
              created_at: "2026-02-01T07:05:00Z",
              status: "ACTIVE",
              slot: "lunch",
            },
          ];
          const filtered = rows.filter((r) => {
            if (filters.company_id && String(r.company_id) !== filters.company_id) return false;
            if (filters.location_id && String(r.location_id) !== filters.location_id) return false;
            return true;
          });
          return resolve({ data: filtered, error: null });
        };
      }

      if (table === "profiles") {
        q.then = (resolve: any) =>
          resolve({
            data: [
              { user_id: "u1", full_name: "A1", department: null, company_id: "cA" },
              { user_id: "u2", full_name: "B1", department: null, company_id: "cB" },
            ],
            error: null,
          });
      }

      if (table === "company_locations") {
        q.then = (resolve: any) =>
          resolve({
            data: [{ id: "lX", name: "LocX" }],
            error: null,
          });
      }

      if (table === "companies") {
        q.then = (resolve: any) =>
          resolve({
            data: [
              { id: "cA", name: "Company A" },
              { id: "cB", name: "Company B" },
            ],
            error: null,
          });
      }

      if (table === "kitchen_batch") {
        q.then = (resolve: any) => resolve({ data: [], error: null });
      }

      return q;
    },
  };
}

describe("tenant isolation – kitchen output", () => {
  test("kitchen output never mixes companies in same group", async () => {
    const admin = makeKitchenAdminStub();
    const { groups } = await fetchKitchenDayData({
      admin,
      dateISO: "2026-02-01",
      companyId: "cA",
      locationId: null,
      slot: null,
      rid: "rid_kitchen",
    });

    const companies = new Set(groups.map((g) => g.company_id));
    expect(companies.size).toBe(1);
    expect(companies.has("cA")).toBe(true);
  });

  test("scale sanity: queries include company_id filter", async () => {
    let sawCompanyEq = false;
    const admin = {
      from: (_table: string) => {
        const q: any = {
          select: () => q,
          eq: (k: string, v: any) => {
            if (k === "company_id" && String(v ?? "") === "cScale") sawCompanyEq = true;
            return q;
          },
          in: () => q,
          order: () => q,
          then: (resolve: any) => resolve({ data: [], error: null }),
        };
        return q;
      },
    };

    await fetchKitchenDayData({
      admin,
      dateISO: "2026-02-01",
      companyId: "cScale",
      locationId: null,
      slot: null,
      rid: "rid_scale",
    });

    expect(sawCompanyEq).toBe(true);
  });
});
