/**
 * GET /api/week — employee profile lookup aligned with orders auth path.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const COMPANY_A = "e0a00000-0000-4000-8000-000000000001";
const COMPANY_B = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const LOCATION_A = "e0a00000-0000-4000-8000-000000000002";
const MELHUS_PROVIDER_ID = "11111111-1111-1111-1111-111111111111";

const mockGetAuthContext = vi.hoisted(() => vi.fn());
const resolveScopeMock = vi.hoisted(() => vi.fn());
const fetchDayTiersMock = vi.hoisted(() => vi.fn());
const getMenuForDateAndPlanMock = vi.hoisted(() => vi.fn());
const loadMsdiMock = vi.hoisted(() => vi.fn());
const opsLogMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
}));

vi.mock("@/lib/menu/providerMenuScope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/menu/providerMenuScope")>();
  return {
    ...actual,
    resolveProviderMenuScopeForCompany: resolveScopeMock,
  };
});

vi.mock("@/lib/agreement/currentAgreement", () => ({
  fetchAgreementDayTiersForCompany: (...args: unknown[]) => fetchDayTiersMock(...args),
}));

vi.mock("@/lib/week/loadEmployeeWeekMenusFromMsdi", () => ({
  loadEmployeeWeekMenusFromMsdi: (...args: unknown[]) => loadMsdiMock(...args),
}));

vi.mock("@/lib/ops/log", () => ({ opsLog: opsLogMock }));

vi.mock("@/lib/cms/menuDay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cms/menuDay")>();
  return {
    ...actual,
    getMenuForDateAndPlan: getMenuForDateAndPlanMock,
  };
});

function agreementsChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const fn of ["select", "eq", "order", "limit"]) {
    chain[fn] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => result);
  return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "agreements") {
        return agreementsChain({
          data: {
            id: "agr-1",
            company_id: COMPANY_A,
            status: "ACTIVE",
            tier: "BASIS",
            price_per_meal_nok: 89,
            delivery_days: ["mon", "tue", "wed", "thu", "fri"],
            starts_at: "2026-01-01",
            ends_at: null,
          },
          error: null,
        });
      }
      return agreementsChain({ data: null, error: null });
    },
  }),
}));

function mkWeekReq(weekOffset = "0") {
  return new Request(`http://localhost/api/week?weekOffset=${weekOffset}`);
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

function employeeAuth(overrides: Record<string, unknown> = {}) {
  mockGetAuthContext.mockResolvedValue({
    ok: true,
    reason: "OK",
    isAuthenticated: true,
    userId: "e0b00000-0000-4000-8000-000000000001",
    role: "employee",
    company_id: COMPANY_A,
    location_id: LOCATION_A,
    ...overrides,
  });
}

function setupHappyPath() {
  employeeAuth();
  fetchDayTiersMock.mockResolvedValue({});
  resolveScopeMock.mockResolvedValue({
    ok: true,
    scope: { providerId: MELHUS_PROVIDER_ID, providerSlug: "melhus-catering", providerName: "Melhus" },
  });
  getMenuForDateAndPlanMock.mockResolvedValue([]);
  loadMsdiMock.mockResolvedValue(new Map());
}

describe("resolveEmployeeWeekScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("valid employee returns company and location scope", async () => {
    employeeAuth();
    const { resolveEmployeeWeekScope } = await import("@/lib/week/resolveEmployeeWeekScope");
    const result = await resolveEmployeeWeekScope(mkWeekReq(), "rid_scope_ok");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.companyId).toBe(COMPANY_A);
    expect(result.locationId).toBe(LOCATION_A);
    expect(result.role).toBe("employee");
  });

  test("NO_PROFILE maps to 409 MISSING_COMPANY", async () => {
    mockGetAuthContext.mockResolvedValue({
      ok: false,
      reason: "NO_PROFILE",
      isAuthenticated: true,
      userId: "u1",
      role: null,
      company_id: null,
      location_id: null,
    });
    const { resolveEmployeeWeekScope } = await import("@/lib/week/resolveEmployeeWeekScope");
    const result = await resolveEmployeeWeekScope(mkWeekReq(), "rid_no_profile");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(409);
    const json = await readJson(result.response);
    expect(json.error).toBe("MISSING_COMPANY");
  });

  test("BLOCKED maps to 403 INACTIVE", async () => {
    mockGetAuthContext.mockResolvedValue({
      ok: false,
      reason: "BLOCKED",
      isAuthenticated: true,
      userId: "u1",
      role: "employee",
      company_id: COMPANY_A,
      location_id: LOCATION_A,
    });
    const { resolveEmployeeWeekScope } = await import("@/lib/week/resolveEmployeeWeekScope");
    const result = await resolveEmployeeWeekScope(mkWeekReq(), "rid_blocked");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
    const json = await readJson(result.response);
    expect(json.error).toBe("INACTIVE");
  });

  test("ERROR maps to 500 PROFILE_LOOKUP_FAILED", async () => {
    mockGetAuthContext.mockResolvedValue({
      ok: false,
      reason: "ERROR",
      isAuthenticated: true,
      userId: "u1",
      role: null,
      company_id: null,
      location_id: null,
    });
    const { resolveEmployeeWeekScope } = await import("@/lib/week/resolveEmployeeWeekScope");
    const result = await resolveEmployeeWeekScope(mkWeekReq(), "rid_error");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(500);
    const json = await readJson(result.response);
    expect(json.error).toBe("PROFILE_LOOKUP_FAILED");
  });

  test("provider role rejected with 403 FORBIDDEN", async () => {
    mockGetAuthContext.mockResolvedValue({
      ok: true,
      reason: "OK",
      isAuthenticated: true,
      userId: "93882f96-38e6-4fdc-8e56-72577e5d595b",
      role: "provider_admin",
      company_id: null,
      location_id: null,
    });
    const { resolveEmployeeWeekScope } = await import("@/lib/week/resolveEmployeeWeekScope");
    const result = await resolveEmployeeWeekScope(mkWeekReq(), "rid_provider");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
    const json = await readJson(result.response);
    expect(json.error).toBe("FORBIDDEN");
  });

  test("unauthenticated maps to 401 AUTH_REQUIRED", async () => {
    mockGetAuthContext.mockResolvedValue({
      ok: false,
      reason: "UNAUTHENTICATED",
      isAuthenticated: false,
      userId: null,
      role: null,
      company_id: null,
      location_id: null,
    });
    const { resolveEmployeeWeekScope } = await import("@/lib/week/resolveEmployeeWeekScope");
    const result = await resolveEmployeeWeekScope(mkWeekReq(), "rid_unauth");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
    const json = await readJson(result.response);
    expect(json.error).toBe("AUTH_REQUIRED");
  });
});

describe("GET /api/week profile lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  test("valid employee with company_id/location_id returns 200 week data", async () => {
    const { GET } = await import("@/app/api/week/route");
    const res = await GET(mkWeekReq());
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.data.agreement.companyId).toBe(COMPANY_A);
    expect(Array.isArray(json.data.days)).toBe(true);
    expect(json.data.days.length).toBe(5);
  });

  test("resolveProviderMenuScopeForCompany called with employee company only", async () => {
    const { GET } = await import("@/app/api/week/route");
    await GET(mkWeekReq());
    expect(resolveScopeMock).toHaveBeenCalledTimes(1);
    expect(resolveScopeMock.mock.calls[0][1]).toBe(COMPANY_A);
  });

  test("company A employee never triggers scope lookup for company B", async () => {
    employeeAuth({ company_id: COMPANY_A });
    const { GET } = await import("@/app/api/week/route");
    await GET(mkWeekReq());
    expect(resolveScopeMock.mock.calls.every((call) => call[1] === COMPANY_A)).toBe(true);
    expect(resolveScopeMock.mock.calls.some((call) => call[1] === COMPANY_B)).toBe(false);
  });

  test("NO_PROFILE returns 409 not 500", async () => {
    mockGetAuthContext.mockResolvedValue({
      ok: false,
      reason: "NO_PROFILE",
      isAuthenticated: true,
      userId: "u1",
      role: null,
      company_id: null,
      location_id: null,
    });
    const { GET } = await import("@/app/api/week/route");
    const res = await GET(mkWeekReq());
    expect(res.status).toBe(409);
    const json = await readJson(res);
    expect(json.error).toBe("MISSING_COMPANY");
    expect(resolveScopeMock).not.toHaveBeenCalled();
  });

  test("membership ERROR returns PROFILE_LOOKUP_FAILED", async () => {
    mockGetAuthContext.mockResolvedValue({
      ok: false,
      reason: "ERROR",
      isAuthenticated: true,
      userId: "u1",
      role: null,
      company_id: null,
      location_id: null,
    });
    const { GET } = await import("@/app/api/week/route");
    const res = await GET(mkWeekReq());
    expect(res.status).toBe(500);
    const json = await readJson(res);
    expect(json.error).toBe("PROFILE_LOOKUP_FAILED");
  });

  test("provider role rejected before menu scope", async () => {
    mockGetAuthContext.mockResolvedValue({
      ok: true,
      reason: "OK",
      isAuthenticated: true,
      userId: "p1",
      role: "provider_admin",
      company_id: null,
      location_id: null,
    });
    const { GET } = await import("@/app/api/week/route");
    const res = await GET(mkWeekReq());
    expect(res.status).toBe(403);
    expect(resolveScopeMock).not.toHaveBeenCalled();
  });

  test("regression: week route does not use loadProfileByUserId", () => {
    const routePath = path.join(process.cwd(), "app/api/week/route.ts");
    const source = fs.readFileSync(routePath, "utf8");
    expect(source).not.toContain("loadProfileByUserId");
    expect(source).toContain("resolveEmployeeWeekScope");
  });
});
