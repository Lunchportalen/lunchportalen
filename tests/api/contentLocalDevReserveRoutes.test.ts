import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";

function mkReq(url: string, init?: RequestInit) {
  return new Request(url, init) as import("next/server").NextRequest;
}

const scopeOr401Mock = vi.hoisted(() => vi.fn());
const requireRoleOr403Mock = vi.hoisted(() => vi.fn());
const supabaseAdminMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: requireRoleOr403Mock,
  q: (request: Request, key: string) => new URL(request.url).searchParams.get(key),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: supabaseAdminMock,
}));

const RESERVE_PAGE_ID = "00000000-0000-4000-8000-00000000c002";
describe.sequential("Local dev content reserve routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: {
        rid: "rid_local_reserve",
        scope: { role: "superadmin", userId: "user_1", companyId: null, locationId: null },
      },
    });
    requireRoleOr403Mock.mockReturnValue(null);
    supabaseAdminMock.mockImplementation(() => {
      throw new Error("supabaseAdmin should not be called while local reserve is enabled");
    });

    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOCAL_DEV_CONTENT_RESERVE", "true");
    vi.stubEnv("LP_LOCAL_CMS_RUNTIME", "off");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("tree route returns reserve roots and pages", async () => {
    const { GET } = await import("@/app/api/backoffice/content/tree/route");
    const res = await GET(mkReq("http://localhost/api/backoffice/content/tree", { method: "GET" }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok?: boolean;
      data?: {
        degraded?: boolean;
        reason?: string;
        roots?: Array<{ id: string; children?: Array<{ id: string }> }>;
      };
    };

    expect(body.ok).toBe(true);
    expect(body.data?.degraded).toBe(true);
    expect(body.data?.reason).toBe("LOCAL_DEV_CONTENT_RESERVE");
    const overlays = body.data?.roots?.find((root) => root.id === "overlays");
    expect(overlays?.children?.some((child) => child.id === RESERVE_PAGE_ID)).toBe(true);
  });

  test("pages routes return reserve data and reject writes", async () => {
    const pagesRoute = await import("@/app/api/backoffice/content/pages/route");
    const pageDetailRoute = await import("@/app/api/backoffice/content/pages/[id]/route");

    const listRes = await pagesRoute.GET(
      mkReq("http://localhost/api/backoffice/content/pages?limit=12", { method: "GET" }),
    );
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as {
      ok?: boolean;
      data?: {
        items?: Array<{ id: string; title: string }>;
        reserve?: boolean;
      };
    };
    expect(listBody.ok).toBe(true);
    expect(listBody.data?.reserve).toBe(true);
    expect(listBody.data?.items?.some((item) => item.id === RESERVE_PAGE_ID)).toBe(true);

    const detailRes = await pageDetailRoute.GET(
      mkReq(`http://localhost/api/backoffice/content/pages/${RESERVE_PAGE_ID}`, { method: "GET" }),
      { params: Promise.resolve({ id: RESERVE_PAGE_ID }) },
    );
    expect(detailRes.status).toBe(200);
    const detailBody = (await detailRes.json()) as {
      ok?: boolean;
      data?: { page?: { id?: string; title?: string; variantId?: string | null } };
    };
    expect(detailBody.ok).toBe(true);
    expect(detailBody.data?.page?.id).toBe(RESERVE_PAGE_ID);
    expect(detailBody.data?.page?.title).toContain("lokal reserve");
    expect(detailBody.data?.page?.variantId).toBe(`local-dev-${RESERVE_PAGE_ID}`);

    const patchRes = await pageDetailRoute.PATCH(
      mkReq(`http://localhost/api/backoffice/content/pages/${RESERVE_PAGE_ID}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Ny tittel" }),
      }),
      { params: Promise.resolve({ id: RESERVE_PAGE_ID }) },
    );
    expect(patchRes.status).toBe(503);
    const patchBody = (await patchRes.json()) as { error?: string; message?: string };
    expect(patchBody.error).toBe("LOCAL_DEV_CONTENT_RESERVE_READONLY");
    expect(patchBody.message).toContain("skrivebeskyttet");
  });
});
