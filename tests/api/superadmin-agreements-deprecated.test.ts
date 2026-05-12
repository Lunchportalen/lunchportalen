import { beforeEach, describe, expect, test, vi } from "vitest";

const scopeOr401Mock = vi.hoisted(() => vi.fn());
const requireRoleOr403Mock = vi.hoisted(() => vi.fn());
const createAgreementDraftFromRegistrationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: requireRoleOr403Mock,
  readJson: vi.fn(async (req: Request) => req.json().catch(() => ({}))),
}));

vi.mock("@/lib/server/superadmin/createAgreementDraftFromRegistration", () => ({
  createAgreementDraftFromRegistration: createAgreementDraftFromRegistrationMock,
}));

function req(url: string, method = "POST") {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST" ? "{}" : undefined,
  }) as any;
}

async function json(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

function setupSuperadmin() {
  scopeOr401Mock.mockResolvedValue({
    ok: true,
    ctx: {
      rid: "rid_deprecated",
      scope: {
        userId: "user_superadmin",
        email: "superadmin@test.lunchportalen.no",
        role: "superadmin",
      },
    },
  });
  requireRoleOr403Mock.mockReturnValue(null);
}

describe("deprecated manual agreement draft flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSuperadmin();
  });

  test("POST /api/superadmin/agreements returns 410 FLOW_DEPRECATED", async () => {
    const route = await import("@/app/api/superadmin/agreements/route");
    const res = await route.POST(req("http://localhost/api/superadmin/agreements"));
    const body = await json(res);

    expect(res.status).toBe(410);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("FLOW_DEPRECATED");
  });

  test("POST /api/superadmin/company-registrations/:companyId/create-agreement-draft returns 410 FLOW_DEPRECATED", async () => {
    const route = await import("@/app/api/superadmin/company-registrations/[companyId]/create-agreement-draft/route");
    const res = await route.POST(
      req("http://localhost/api/superadmin/company-registrations/test-company-id/create-agreement-draft"),
      { params: Promise.resolve({ companyId: "test-company-id" }) },
    );
    const body = await json(res);

    expect(res.status).toBe(410);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("FLOW_DEPRECATED");
    expect(createAgreementDraftFromRegistrationMock).not.toHaveBeenCalled();
  });

  test("GET /api/superadmin/agreements keeps its existing read handler contract", async () => {
    const route = await import("@/app/api/superadmin/agreements/route");
    const res = await route.GET(req("http://localhost/api/superadmin/agreements", "GET"));
    const body = await json(res);

    expect(res.status).toBe(405);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("METHOD_NOT_ALLOWED");
  });
});
