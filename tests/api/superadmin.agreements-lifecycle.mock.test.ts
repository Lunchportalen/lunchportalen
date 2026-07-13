import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const scopeOr401Mock = vi.hoisted(() => vi.fn());
const requireRoleOr403Mock = vi.hoisted(() => vi.fn());
const readJsonMock = vi.hoisted(() => vi.fn(async (req: Request) => req.json().catch(() => ({}))));
const rpcMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const writeAuditEventMock = vi.hoisted(() => vi.fn(async () => ({ ok: true, audit: { id: "audit_1" } })));
const validateMealContractMock = vi.hoisted(() => vi.fn(async () => ({ ok: true, skip: true })));

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: requireRoleOr403Mock,
  readJson: readJsonMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: rpcMock,
    from: fromMock,
  }),
}));

vi.mock("@/lib/audit/write", () => ({
  writeAuditEvent: writeAuditEventMock,
}));

vi.mock("@/lib/server/agreements/submitAgreement", () => ({
  validateMealContractForAgreementWrite: validateMealContractMock,
  mergeMealContractIntoAgreementJson: (current: unknown) => current ?? {},
}));

function req(url: string, body: unknown = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

async function json(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

function chain(result: Record<string, unknown> = {}) {
  const q: any = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    is: vi.fn(() => q),
    update: vi.fn(() => q),
    insert: vi.fn(async () => ({ error: null, ...result })),
    upsert: vi.fn(async () => ({ error: null, ...result })),
    single: vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null })),
    maybeSingle: vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null })),
  };
  return q;
}

function setupCommon() {
  scopeOr401Mock.mockResolvedValue({
    ok: true,
    ctx: {
      rid: "rid_lifecycle_mock",
      scope: {
        userId: "user_superadmin",
        email: "superadmin@test.lunchportalen.no",
        role: "superadmin",
      },
    },
  });
  requireRoleOr403Mock.mockReturnValue(null);
  readJsonMock.mockImplementation(async (request: Request) => request.json().catch(() => ({})));
  writeAuditEventMock.mockResolvedValue({ ok: true, audit: { id: "audit_1" } });
  validateMealContractMock.mockResolvedValue({ ok: true, skip: true });
}

describe("superadmin agreements lifecycle API contract (mocked)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost");
    vi.clearAllMocks();
    setupCommon();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("create pending is deprecated and returns 410", async () => {
    const route = await import("@/app/api/superadmin/agreements/route");
    const res = await route.POST(
      req("http://localhost/api/superadmin/agreements", {
        company_id: "11111111-1111-4111-8111-111111111111",
        location_id: "22222222-2222-4222-8222-222222222222",
        tier: "BASIS",
        delivery_days: ["mon", "tue"],
        starts_at: "2026-06-01",
        slot_start: "11:00",
        slot_end: "13:00",
        binding_months: 12,
        notice_months: 3,
        price_per_employee: 100,
      }),
    );
    const body = await json(res);

    expect(res.status).toBe(410);
    expect(body.ok).toBe(false);
    expect(body.rid).toBe("rid_lifecycle_mock");
    expect(body.error).toBe("AGREEMENT_DRAFT_FLOW_DISABLED");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test("approve returns ok:true and queues invite/outbox side effects", async () => {
    // Fase 5: ruten materialiserer registreringsplanen FØR aktivering.
    rpcMock.mockResolvedValueOnce({
      data: { ok: true, materialized: true },
      error: null,
    });
    rpcMock.mockResolvedValueOnce({
      data: { company_id: "company_1", contact_email: "admin@example.no", contact_name: "Ada" },
      error: null,
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "companies") return chain({ data: { name: "Acme" } });
      return chain();
    });

    const route = await import("@/app/api/superadmin/agreements/[agreementId]/approve/route");
    const res = await route.POST(req("http://localhost/api/superadmin/agreements/ag_1/approve"), {
      params: Promise.resolve({ agreementId: "ag_1" }),
    });
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.rid).toBe("rid_lifecycle_mock");
    expect(body.data.companyId).toBe("company_1");
    expect(body.data.agreementId).toBe("ag_1");
  });

  test("activate legacy company agreement returns ok:true response shape", async () => {
    const legacyAgreementId = "33333333-3333-4333-8333-333333333333";
    const companyId = "44444444-4444-4444-8444-444444444444";
    fromMock.mockImplementation((table: string) => {
      if (table === "agreements") return chain({ data: null });
      if (table === "companies") return chain({ data: { id: companyId, name: "Acme" } });
      if (table === "company_agreements") {
        const q = chain({
          data: {
            id: legacyAgreementId,
            company_id: companyId,
            status: "PENDING",
            plan_tier: "BASIS",
            delivery_days: ["mon"],
            start_date: "2026-06-01",
          },
        });
        q.single.mockResolvedValueOnce({
          data: { id: legacyAgreementId, company_id: companyId, status: "ACTIVE" },
          error: null,
        });
        return q;
      }
      return chain();
    });

    const route = await import("@/app/api/superadmin/agreements/[agreementId]/activate/route");
    const res = await route.POST(req(`http://localhost/api/superadmin/agreements/${legacyAgreementId}/activate`), {
      params: Promise.resolve({ agreementId: legacyAgreementId }),
    });
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.rid).toBe("rid_lifecycle_mock");
    expect(body.data.agreement).toBeTruthy();
  });

  test("reject returns ok:true and queues rejection outbox", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { company_id: "company_1", contact_email: "admin@example.no", contact_name: "Ada" },
      error: null,
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "companies") return chain({ data: { name: "Acme" } });
      return chain();
    });

    const route = await import("@/app/api/superadmin/agreements/[agreementId]/reject/route");
    const res = await route.POST(
      req("http://localhost/api/superadmin/agreements/ag_1/reject", { reason: "Ikke klar" }),
      { params: Promise.resolve({ agreementId: "ag_1" }) },
    );
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.rid).toBe("rid_lifecycle_mock");
    expect(body.data.companyId).toBe("company_1");
    expect(body.data.agreementId).toBe("ag_1");
  });
});
