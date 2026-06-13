// @ts-nocheck
// Provider-scope for menyverifisering i POST /api/orders/set:
// - meny-gaten (read-only validering) scopes til providers slug (server truth)
// - fail-closed: kontrollert 409 MENU_NOT_PUBLISHED — aldri global meny, ingen RPC-skriv
// - CANCEL: ingen menylesing — write-path uendret
// - lp_order_set RPC-input er uendret (samme params som før)
import { beforeEach, describe, expect, test, vi } from "vitest";

const getPublishedMenuForDateMock = vi.hoisted(() => vi.fn());
const resolveScopeMock = vi.hoisted(() => vi.fn());
const opsLogMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cms/menuDay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cms/menuDay")>();
  return {
    ...actual,
    getPublishedMenuForDate: getPublishedMenuForDateMock,
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
        route: "/api/orders/set",
        method: "POST",
        scope: { userId: "u1", companyId: ctxCompanyId, locationId: "", role: "employee", email: "emp@test.no" },
      },
    }),
    requireRoleOr403: () => null,
    readJson: async (req: Request) => req.json(),
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ from: () => ({}) }),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    rpc: rpcMock,
  }),
}));

vi.mock("@/lib/orders/companyOrderEligibility", () => ({
  assertCompanyOrderWriteAllowed: async () => ({ ok: true }),
}));

vi.mock("@/lib/orders/orderWriteGuard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/orders/orderWriteGuard")>();
  return {
    ...actual,
    assertOrderWithinAgreementPreflight: async () => ({ ok: true }),
  };
});

vi.mock("@/lib/audit/log", () => ({
  auditLog: vi.fn(),
  buildAuditEventFromAuthedCtx: () => ({}),
}));

vi.mock("@/lib/orderBackup/outbox", () => ({
  fanoutLpOrderSetOutboxBestEffort: vi.fn(async () => {}),
}));

import { POST } from "@/app/api/orders/set/route";

function mkReq(body: unknown) {
  return new Request("http://localhost/api/orders/set", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

beforeEach(() => {
  getPublishedMenuForDateMock.mockReset();
  resolveScopeMock.mockReset();
  opsLogMock.mockReset();
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({
    data: [{ order_id: "ord_1", status: "ACTIVE", date: "2026-06-15" }],
    error: null,
  });
  ctxCompanyId = "company-a";
});

describe("POST /api/orders/set provider-menuScope", () => {
  test("ORDER scoped: meny-gate leser kun providerens meny og RPC-input er uendret", async () => {
    resolveScopeMock.mockResolvedValue({
      ok: true,
      scope: { providerId: "prov-a-id", providerSlug: "provider-a", providerName: "Provider A" },
    });
    getPublishedMenuForDateMock.mockResolvedValue({ date: "2026-06-15", isPublished: true });

    const res = await POST(mkReq({ date: "2026-06-15", action: "ORDER", choice_key: "varmmat" }));
    expect(res.status).toBe(200);

    expect(resolveScopeMock.mock.calls[0][1]).toBe("company-a");
    expect(getPublishedMenuForDateMock).toHaveBeenCalledWith("2026-06-15", { providerSlug: "provider-a" });

    // Write semantics uendret: samme RPC og samme params-kontrakt.
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("lp_order_set", {
      p_date: "2026-06-15",
      p_action: "SET",
      p_note: null,
      p_slot: expect.any(String),
      p_choice_key: "varmmat",
      p_item_key: "default",
    });
  });

  test("A/B-isolasjon: Provider B-context bruker B-slug, aldri A-slug", async () => {
    ctxCompanyId = "company-b";
    resolveScopeMock.mockResolvedValue({
      ok: true,
      scope: { providerId: "prov-b-id", providerSlug: "provider-b", providerName: "Provider B" },
    });
    // Provider B har ingen publisert meny for datoen — selv om Provider A skulle hatt det.
    getPublishedMenuForDateMock.mockResolvedValue(null);

    const res = await POST(mkReq({ date: "2026-06-15", action: "ORDER", choice_key: "varmmat" }));
    const json = await readJson(res);

    expect(getPublishedMenuForDateMock).toHaveBeenCalledWith("2026-06-15", { providerSlug: "provider-b" });
    expect(res.status).toBe(409);
    expect(json.error ?? json.code).toBeDefined();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test("fail-closed: kontrollert 409, ingen global menylesing, ingen RPC-skriv", async () => {
    resolveScopeMock.mockResolvedValue({ ok: false, reason: "LOOKUP_FAILED" });

    const res = await POST(mkReq({ date: "2026-06-15", action: "ORDER", choice_key: "varmmat" }));
    expect(res.status).toBe(409);

    expect(getPublishedMenuForDateMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
    expect(opsLogMock).toHaveBeenCalledWith(
      "orders.set.menuScope",
      expect.objectContaining({ mode: "fail-closed", reason: "LOOKUP_FAILED" }),
    );
  });

  test("legacy-unscoped: company uten provider beholder dagens lesing", async () => {
    resolveScopeMock.mockResolvedValue({ ok: false, reason: "NO_PROVIDER" });
    getPublishedMenuForDateMock.mockResolvedValue({ date: "2026-06-15", isPublished: true });

    const res = await POST(mkReq({ date: "2026-06-15", action: "ORDER", choice_key: "varmmat" }));
    expect(res.status).toBe(200);

    expect(getPublishedMenuForDateMock).toHaveBeenCalledWith("2026-06-15", undefined);
  });

  test("CANCEL: ingen menylesing og write-path uendret", async () => {
    rpcMock.mockResolvedValue({
      data: [{ order_id: "ord_1", status: "CANCELLED", date: "2026-06-15" }],
      error: null,
    });

    const res = await POST(mkReq({ date: "2026-06-15", action: "CANCEL" }));
    expect(res.status).toBe(200);

    expect(resolveScopeMock).not.toHaveBeenCalled();
    expect(getPublishedMenuForDateMock).not.toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledWith(
      "lp_order_set",
      expect.objectContaining({ p_action: "CANCEL", p_choice_key: null }),
    );
  });
});
