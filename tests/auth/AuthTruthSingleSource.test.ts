import { beforeEach, describe, expect, test, vi } from "vitest";

const getAuthContextMock = vi.hoisted(() => vi.fn());
const resolveRunnerCompanyIdForBackofficeMock = vi.hoisted(() => vi.fn());
const createServerClientMock = vi.hoisted(() => vi.fn());

let profileMetaRow: {
  id: string;
  email: string | null;
  is_active: boolean | null;
  disabled_at: string | null;
  disabled_reason: string | null;
} | null = null;
let companyRow: { id: string; status: string | null } | null = null;

vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: getAuthContextMock,
}));

vi.mock("@/lib/ai/resolveRunnerCompanyForBackoffice", () => ({
  resolveRunnerCompanyIdForBackoffice: resolveRunnerCompanyIdForBackofficeMock,
}));

vi.mock("@/lib/http/withApiAiEntrypoint", () => ({
  withApiAiEntrypoint: (_req: Request, _method: string, handler: () => Promise<Response>) => handler(),
}));

vi.mock("@/lib/observability/eventLogger", () => ({
  observeResponse: (_meta: unknown, handler: () => Promise<Response>) => handler(),
}));

vi.mock("@/lib/experiments/tracker", () => ({
  trackEvent: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/ops/log", () => ({
  opsLog: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    get: () => undefined,
    set: () => undefined,
  }),
}));

createServerClientMock.mockImplementation(() => ({
  from: (_table: string) => ({
    select: (_columns: string) => ({
      eq: (_column: string, _value: string) => ({
        maybeSingle: async () => ({ data: profileMetaRow, error: null }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    from: (_table: string) => ({
      select: (_columns: string) => ({
        eq: (_column: string, _value: string) => ({
          maybeSingle: async () => ({ data: profileMetaRow, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/admin", async () => {
  return {
    hasSupabaseAdminConfig: () => false,
    supabaseAdmin: (() =>
      ({
        from: (_table: string) => ({
          select: (_columns: string) => ({
            eq: (_column: string, _value: string) => ({
              maybeSingle: async () => ({ data: companyRow, error: null }),
            }),
          }),
        }),
      })) as any,
  };
});

function mkNextReq(url: string) {
  const req = new Request(url) as Request & { nextUrl?: URL };
  req.nextUrl = new URL(url);
  return req as import("next/server").NextRequest;
}

function makeAuth(
  overrides: Partial<Awaited<ReturnType<typeof getAuthContextMock>>> = {},
) {
  return {
    ok: true,
    reason: "OK",
    mode: "DB_LOOKUP",
    user: { id: "user_1", email: "admin@example.com" },
    role: "company_admin",
    company_id: "company_1",
    location_id: null,
    rid: "rid_auth_truth",
    userId: "user_1",
    email: "admin@example.com",
    isAuthenticated: true,
    isSessionValid: true,
    isRefreshable: true,
    hasAuthError: false,
    errorType: "NONE",
    source: "SSR_COOKIE",
    sessionOk: true,
    shouldAttemptRefresh: false,
    ...overrides,
  };
}

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("Auth truth single source", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    profileMetaRow = {
      id: "user_1",
      email: "admin@example.com",
      is_active: true,
      disabled_at: null,
      disabled_reason: null,
    };
    companyRow = { id: "company_1", status: "ACTIVE" };
    getAuthContextMock.mockResolvedValue(makeAuth());
    resolveRunnerCompanyIdForBackofficeMock.mockResolvedValue(null);
  });

  test("/api/auth/me returns the canonical auth context shape", async () => {
    const { GET } = await import("@/app/api/auth/me/route");
    const res = await GET(mkNextReq("http://localhost/api/auth/me"));
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.user).toMatchObject({
      id: "user_1",
      email: "admin@example.com",
      role: "company_admin",
      companyId: "company_1",
    });
  });

  test("/api/profile and /api/auth/profile are thin adapters over the same truth", async () => {
    const profileRoute = await import("@/app/api/profile/route");
    const authProfileRoute = await import("@/app/api/auth/profile/route");
    const req = mkNextReq("http://localhost/api/profile");

    const [profileRes, authProfileRes] = await Promise.all([
      profileRoute.GET(req),
      authProfileRoute.GET(req),
    ]);
    const profileJson = await readJson(profileRes);
    const authProfileJson = await readJson(authProfileRes);

    expect(authProfileJson).toMatchObject({
      ok: true,
      data: {
        company_status: profileJson.data.company_status,
        pending: profileJson.data.pending,
        profileExists: profileJson.data.profileExists,
        profile: profileJson.data.profile,
      },
    });
    expect(profileJson.data.company_status).toBe("ACTIVE");
    expect(profileJson.data.profile.role).toBe("company_admin");
    expect(profileJson.data.profile.company_id).toBe("company_1");
  });

  test("redirect and post-login resolve the same landing target from canonical auth truth", async () => {
    getAuthContextMock.mockResolvedValue(
      makeAuth({
        role: "superadmin",
        company_id: null,
        location_id: null,
      }),
    );

    const redirectRoute = await import("@/app/api/auth/redirect/route");
    const postLoginRoute = await import("@/app/api/auth/post-login/route");

    const redirectRes = await redirectRoute.GET(
      mkNextReq("http://localhost/api/auth/redirect?next=%2Fbackoffice%2Fcontent"),
    );
    const postLoginRes = await postLoginRoute.GET(
      mkNextReq("http://localhost/api/auth/post-login?rid=rid_auth_truth&next=%2Fbackoffice%2Fcontent"),
    );

    const redirectTarget = new URL(String(redirectRes.headers.get("Location")));
    const postLoginTarget = new URL(String(postLoginRes.headers.get("Location")));

    expect(redirectTarget.pathname).toBe("/backoffice/content");
    expect(postLoginTarget.pathname).toBe("/backoffice/content");
  });
});
