// tests/rls/companyAdminStatusGate.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

/* =========================================================
   Helpers
========================================================= */
function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers }) as any;
}
async function readBodySafe(res: Response) {
  const t = await res.text();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t };
  }
}

/* =========================================================
   Test state
========================================================= */
let companyStatus: "ACTIVE" | "PAUSED" | "CLOSED" = "ACTIVE";

const SCOPE = {
  userId: "u1",
  role: "company_admin",
  companyId: "c1",
  locationId: "l1",
  email: "test@lunchportalen.no",
};

/* =========================================================
   Mocks (status-gate focus)
   - Goal: verify PAUSED/CLOSED => 403, ACTIVE => not blocked by 401/403.
   - We avoid requiring full write-path success (200), which belongs elsewhere.
========================================================= */

// ✅ Some routes pull scope via @/lib/auth/scope
vi.mock("@/lib/auth/scope", () => ({
  getScope: vi.fn(async () => ({ ...SCOPE })),
}));

// ✅ Toggle route bruker Dag-10 routeGuard helpers
vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: vi.fn(async () => ({
    ok: true as const,
    ctx: {
      rid: "rid_test",
      route: "/api/orders/toggle",
      method: "POST",
      scope: { ...SCOPE },
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

// ✅ Company status lookup (this is what we are testing)
vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

  supabaseAdmin: () => ({
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => {
          if (table === "companies") {
            return { data: { id: SCOPE.companyId, status: companyStatus }, error: null };
          }
          // allow other reads without blowing up this gate test
          return { data: null, error: null };
        },
      };
      return q;
    },
  }),
  };
});

// ✅ Keep these harmless if route touches them
vi.mock("@/lib/date/oslo", () => ({
  isIsoDate: () => true,
  cutoffStatusForDate: () => "OPEN",
  osloNowISO: () => "2026-01-29T07:00:00.000Z",
}));

vi.mock("@/lib/agreement/requireRule", () => ({
  requireRule: vi.fn(async () => ({ ok: true, rule: { tier: "BASIS" } })),
}));

vi.mock("@/lib/orders/orderBackup", () => ({
  sendOrderBackup: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/orders/backupContext", () => ({
  fetchCompanyLocationNames: vi.fn(async () => ({
    companyName: "Test Company",
    locationName: "Test Location",
  })),
}));

vi.mock("@/lib/audit/auditWrite", () => ({
  auditWriteMust: vi.fn(async () => true),
}));

vi.mock("@/lib/ops/auditSafe", () => ({
  auditSafe: vi.fn(async () => true),
}));

// ✅ CRITICAL: Next cookies store must implement getAll/setAll for Supabase SSR
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => undefined,
    set: () => undefined,
    getAll: () => [],
    setAll: () => undefined,
    delete: () => undefined,
  }),
}));

/* =========================================================
   Tests
========================================================= */
describe("RLS: company_admin status gate (active/paused/closed)", () => {
  beforeEach(() => {
    companyStatus = "ACTIVE";
    vi.resetModules(); // ensure route import happens AFTER mocks each test
  });

  async function callToggle(body: any) {
    const mod = await import("../../app/api/orders/toggle/route");
    const req = mkReq("http://localhost/api/orders/toggle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return mod.POST(req);
  }

  test("ACTIVE -> status gate allows request (not 401/403)", async () => {
    companyStatus = "ACTIVE";

    const res = await callToggle({
      date: "2026-01-29",
      slot: "lunch",
      // send BOTH variants to match different toggle contracts
      wantsLunch: true,
      action: "place",
      choice_key: "standard",
      note: null,
    });

    const body = await readBodySafe(res);

    // ACTIVE must not be blocked by auth or status gate
    expect([401, 403]).not.toContain(res.status);

    // Optional sanity if success
    if (res.status === 200 && body?.order?.status) {
      expect(String(body.order.status)).toBe("ACTIVE");
    }
  });

  test("PAUSED -> request is blocked (403)", async () => {
    companyStatus = "PAUSED";

    const res = await callToggle({
      date: "2026-01-29",
      slot: "lunch",
      wantsLunch: true,
      action: "place",
      choice_key: "standard",
    });

    expect(res.status).toBe(403);
  });

  test("CLOSED -> request is blocked (403)", async () => {
    companyStatus = "CLOSED";

    const res = await callToggle({
      date: "2026-01-29",
      slot: "lunch",
      wantsLunch: false,
      action: "cancel",
    });

    expect(res.status).toBe(403);
  });
});
