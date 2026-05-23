// @ts-nocheck
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

const scopeOr401Mock = vi.fn();
const requireRoleOr403Mock = vi.fn();

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: (...args: unknown[]) => scopeOr401Mock(...args),
  requireRoleOr403: (...args: unknown[]) => requireRoleOr403Mock(...args),
  denyResponse: (gate: { res?: Response }) => gate.res ?? new Response(null, { status: 401 }),
}));

vi.mock("@/lib/security/audit", () => ({
  scheduleAuditEvent: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
    auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } },
  }),
}));

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers }) as any;
}

describe("DC-011 route fixes", () => {
  beforeEach(() => {
    scopeOr401Mock.mockReset();
    requireRoleOr403Mock.mockReset();
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.LP_DEBUG_AUTH;
    delete process.env.LP_DEV_BYPASS;
    vi.unstubAllEnvs();
  });

  test("GET /api/auth/debug-cookies → 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { GET } = await import("@/app/api/auth/debug-cookies/route");
    const res = await GET(mkReq("http://localhost/api/auth/debug-cookies"));
    expect(res.status).toBe(404);
  });

  test("GET /api/auth/debug-cookies → 404 without LP_DEBUG_AUTH in dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.LP_DEBUG_AUTH;
    const { GET } = await import("@/app/api/auth/debug-cookies/route");
    const res = await GET(mkReq("http://localhost/api/auth/debug-cookies"));
    expect(res.status).toBe(404);
  });

  test("GET /api/auth/profile → 401 without session", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(JSON.stringify({ ok: false }), { status: 401 }),
      ctx: { rid: "r1", scope: {} },
    });
    const { GET } = await import("@/app/api/auth/profile/route");
    const res = await GET(mkReq("http://localhost/api/auth/profile"));
    expect(res.status).toBe(401);
  });

  test("POST /api/superadmin/users/set-company-admin → 403 for non-superadmin", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: {
        rid: "r1",
        scope: { userId: "u1", role: "employee", companyId: null, locationId: null, email: null, sub: null },
      },
    });
    requireRoleOr403Mock.mockReturnValue(new Response(null, { status: 403 }));
    const { POST } = await import("@/app/api/superadmin/users/set-company-admin/route");
    const res = await POST(
      mkReq("http://localhost/api/superadmin/users/set-company-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "a@b.no", companyName: "X", locationLabel: "Y" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  test("POST /api/system/outbox/process → 401 without cron secret", async () => {
    process.env.CRON_SECRET = "secret";
    const { POST } = await import("@/app/api/system/outbox/process/route");
    const res = await POST(mkReq("http://localhost/api/system/outbox/process", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  test("GET /api/cron/meal-learning → 401 without cron secret when CRON_SECRET set", async () => {
    process.env.CRON_SECRET = "secret";
    const { GET } = await import("@/app/api/cron/meal-learning/route");
    const res = await GET(mkReq("http://localhost/api/cron/meal-learning"));
    expect(res.status).toBe(401);
  });
});
