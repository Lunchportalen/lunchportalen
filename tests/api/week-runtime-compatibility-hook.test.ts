/**
 * G5d.7c — GET /api/week runtime compatibility hook wiring tests.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

import {
  LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV,
} from "@/lib/menu-profile/featureFlag";
import * as resolver from "@/lib/menu-profile/weekRuntimeCompatibilityResolver.server";

const COMPANY_A = "e0a00000-0000-4000-8000-000000000001";
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

function setupHappyPath() {
  mockGetAuthContext.mockResolvedValue({
    ok: true,
    reason: "OK",
    isAuthenticated: true,
    userId: "e0b00000-0000-4000-8000-000000000001",
    role: "employee",
    company_id: COMPANY_A,
    location_id: LOCATION_A,
  });
  fetchDayTiersMock.mockResolvedValue({});
  resolveScopeMock.mockResolvedValue({
    ok: true,
    scope: { providerId: MELHUS_PROVIDER_ID, providerSlug: "melhus-catering", providerName: "Melhus" },
  });
  getMenuForDateAndPlanMock.mockResolvedValue([]);
  loadMsdiMock.mockResolvedValue(new Map());
}

const FORBIDDEN_RESPONSE_KEYS = [
  "providerId",
  "employeePayload",
  "orderPayload",
  "publishPayload",
  "sanityWritePayload",
  "menuDayPayloadMutation",
  "pricePreview",
  "provider_price_rules",
  "commission",
  "provisjon",
  "candidateOrderable",
  "orderableCandidate",
  "sourceOfTruthChanged",
  "autoRollout",
  "compatibilityCutover",
  "weekShadow",
  "publishShadow",
];

describe("G5d.7c — GET /api/week flag OFF parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
    delete process.env[LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV];
  });

  afterEach(() => {
    delete process.env[LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV];
  });

  test("flag OFF returns unchanged employee week payload shape", async () => {
    const decisionSpy = vi.spyOn(resolver, "buildWeekRuntimeCompatibilityDecision");
    const { GET } = await import("@/app/api/week/route");
    const res = await GET(mkWeekReq());
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.data.agreement.companyId).toBe(COMPANY_A);
    expect(Array.isArray(json.data.days)).toBe(true);
    expect(json.data.days.length).toBe(5);
    expect(decisionSpy).not.toHaveBeenCalled();
    decisionSpy.mockRestore();
  });

  test("flag OFF response excludes provider/internal and commercial DTO keys", async () => {
    const { GET } = await import("@/app/api/week/route");
    const res = await GET(mkWeekReq());
    const body = JSON.stringify(await readJson(res));
    for (const key of FORBIDDEN_RESPONSE_KEYS) {
      expect(body).not.toContain(`"${key}"`);
    }
  });
});

describe("G5d.7c — GET /api/week flag ON Preview behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
    process.env[LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV] = "true";
  });

  afterEach(() => {
    delete process.env[LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV];
  });

  test("flag ON still returns current employee week output", async () => {
    const decisionSpy = vi.spyOn(resolver, "buildWeekRuntimeCompatibilityDecision");
    const { GET } = await import("@/app/api/week/route");
    const res = await GET(mkWeekReq());
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.data.agreement.companyId).toBe(COMPANY_A);
    expect(Array.isArray(json.data.days)).toBe(true);
    expect(json.data.days.length).toBe(5);
    expect(decisionSpy).toHaveBeenCalledTimes(1);
    const decision = decisionSpy.mock.results[0]?.value;
    expect(decision.selectedSource).toBe("current");
    expect(decision.candidateOrderable).toBe(false);
    expect(decision.sourceOfTruthChanged).toBe(false);
    expect(decision.autoRollout).toBe(false);
    expect(decision.fallbackToCurrent).toBe(true);
    decisionSpy.mockRestore();
  });

  test("flag ON response excludes provider/internal and commercial DTO keys", async () => {
    const { GET } = await import("@/app/api/week/route");
    const res = await GET(mkWeekReq());
    const body = JSON.stringify(await readJson(res));
    for (const key of FORBIDDEN_RESPONSE_KEYS) {
      expect(body).not.toContain(`"${key}"`);
    }
    expect(body).not.toContain("compatibilityOnly");
    expect(body).not.toContain("providerOnly");
  });
});
