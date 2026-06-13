// @ts-nocheck
// Provider-scope for menuDay i GET /api/orders/week:
// - scoped: getMenuForDates kalles med providerSlug (server truth, aldri klientinput)
// - A/B-isolasjon: Provider A og B med samme uke gir separate queries (og separate cache-keys)
// - fail-closed: ingen menuDay-henting, menuPublished=false for alle dager
// - legacy-unscoped: dagens (globale) lesing beholdes for company uten provider
import { beforeEach, describe, expect, test, vi } from "vitest";

const getMenuForDatesMock = vi.hoisted(() => vi.fn());
const resolveScopeMock = vi.hoisted(() => vi.fn());
const opsLogMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cms/menuDay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cms/menuDay")>();
  return {
    ...actual,
    getMenuForDates: getMenuForDatesMock,
    menuDayHasDisplayableCopy: () => true,
  };
});

vi.mock("@/lib/menu/providerMenuScope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/menu/providerMenuScope")>();
  return {
    ...actual,
    resolveProviderMenuScopeForCompany: resolveScopeMock,
  };
});

vi.mock("@/lib/ops/log", () => ({ opsLog: opsLogMock }));

let ctxCompanyId = "company-a";

vi.mock("@/lib/http/routeGuard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http/routeGuard")>();
  return {
    ...actual,
    scopeOr401: async () => ({
      ok: true,
      ctx: {
        rid: "rid_test",
        route: "/api/orders/week",
        method: "GET",
        scope: { userId: "u1", companyId: ctxCompanyId, locationId: "", role: "employee", email: "emp@test.no" },
      },
    }),
    requireRoleOr403: () => null,
    requireCompanyScopeOr403: () => null,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        limit: async () => ({ error: null }),
      }),
    }),
  }),
}));

function ordersChain() {
  const chain: any = {};
  for (const fn of ["select", "eq", "gte", "lte", "order"]) {
    chain[fn] = vi.fn(() => chain);
  }
  chain.then = (resolve: any, reject: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject);
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    from: () => ordersChain(),
  }),
}));

import { GET } from "@/app/api/orders/week/route";

function mkReq() {
  return { nextUrl: new URL("http://localhost/api/orders/week") } as any;
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

beforeEach(() => {
  getMenuForDatesMock.mockReset();
  resolveScopeMock.mockReset();
  opsLogMock.mockReset();
  ctxCompanyId = "company-a";
});

describe("GET /api/orders/week provider-menuScope", () => {
  test("scoped: getMenuForDates kalles med providers slug fra server-resolver", async () => {
    resolveScopeMock.mockResolvedValue({
      ok: true,
      scope: { providerId: "prov-a-id", providerSlug: "provider-a", providerName: "Provider A" },
    });
    getMenuForDatesMock.mockImplementation(async (dates: string[]) => [
      { date: dates[0], isPublished: true },
    ]);

    const res = await GET(mkReq());
    expect(res.status).toBe(200);

    expect(resolveScopeMock).toHaveBeenCalledTimes(1);
    expect(resolveScopeMock.mock.calls[0][1]).toBe("company-a");

    expect(getMenuForDatesMock).toHaveBeenCalledTimes(1);
    expect(getMenuForDatesMock.mock.calls[0][1]).toEqual({
      providerSlug: "provider-a",
      providerRef: "prov-a-id",
    });

    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.data.days[0].menuPublished).toBe(true);
  });

  test("A/B-isolasjon: Provider B i samme uke gir egen scoped query (ingen cache-hit fra A)", async () => {
    resolveScopeMock.mockResolvedValue({
      ok: true,
      scope: { providerId: "prov-b-id", providerSlug: "provider-b", providerName: "Provider B" },
    });
    getMenuForDatesMock.mockResolvedValue([]);
    ctxCompanyId = "company-b";

    const res = await GET(mkReq());
    expect(res.status).toBe(200);

    expect(getMenuForDatesMock).toHaveBeenCalledTimes(1);
    expect(getMenuForDatesMock.mock.calls[0][1]).toEqual({
      providerSlug: "provider-b",
      providerRef: "prov-b-id",
    });

    // Provider B fikk tom meny — ikke Provider A sine publiserte dager.
    const json = await readJson(res);
    expect(json.data.days.every((d: any) => d.menuPublished === false)).toBe(true);
  });

  test("fail-closed: ingen menuDay-henting og menuPublished=false for alle dager", async () => {
    resolveScopeMock.mockResolvedValue({ ok: false, reason: "LOOKUP_FAILED" });
    ctxCompanyId = "company-fail";

    const res = await GET(mkReq());
    expect(res.status).toBe(200);

    expect(getMenuForDatesMock).not.toHaveBeenCalled();

    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.data.days).toHaveLength(5);
    expect(json.data.days.every((d: any) => d.menuPublished === false)).toBe(true);

    expect(opsLogMock).toHaveBeenCalledWith(
      "orders.week.menuScope",
      expect.objectContaining({ mode: "fail-closed", reason: "LOOKUP_FAILED" }),
    );
  });

  test("legacy-unscoped: company uten provider beholder dagens globale lesing", async () => {
    resolveScopeMock.mockResolvedValue({ ok: false, reason: "NO_PROVIDER" });
    getMenuForDatesMock.mockResolvedValue([]);
    ctxCompanyId = "company-legacy";

    const res = await GET(mkReq());
    expect(res.status).toBe(200);

    expect(getMenuForDatesMock).toHaveBeenCalledTimes(1);
    expect(getMenuForDatesMock.mock.calls[0][1]).toBeUndefined();

    expect(opsLogMock).toHaveBeenCalledWith(
      "orders.week.menuScope",
      expect.objectContaining({ mode: "legacy-unscoped" }),
    );
  });
});
