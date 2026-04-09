/**
 * tests/security/privilegeBoundaries.test.ts
 * Critical privilege boundaries: backoffice/superadmin require auth+role; internal scheduler requires cron auth.
 */

// @ts-nocheck

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers: headers as HeadersInit }) as any;
}

async function readJson(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t };
  }
}

const scopeOr401Mock = vi.hoisted(() => vi.fn());
const requireRoleOr403Mock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: requireRoleOr403Mock,
  q: () => null,
}));

describe("Privilege boundaries — backoffice content pages", () => {
  vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

    supabaseAdmin: () => ({
      from: () => ({
        select: () => ({ order: () => ({ order: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) }),
      }),
    }),
    };
});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("GET returns 403 when authenticated as company_admin (not superadmin)", async () => {
    const { GET } = await import("../../app/api/backoffice/content/pages/route");
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: {
        rid: "rid_test",
        route: "/api/backoffice/content/pages",
        method: "GET",
        scope: { userId: "u1", role: "company_admin", companyId: "c1", locationId: null, email: "admin@test.no" },
      },
    });
    requireRoleOr403Mock.mockReturnValue(new Response(JSON.stringify({ ok: false, error: "FORBIDDEN" }), { status: 403 }));

    const res = await GET(mkReq("http://x/api/backoffice/content/pages", { method: "GET" }));
    expect(res.status).toBe(403);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
  });
});

describe("Privilege boundaries — superadmin gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("GET /api/superadmin/_gate rejects non-superadmin (company_admin)", async () => {
    const { GET } = await import("../../app/api/superadmin/_gate/route");

    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: {
        rid: "rid_test_gate",
        route: "/api/superadmin/_gate",
        method: "GET",
        scope: { userId: "u1", role: "company_admin", companyId: "c1", locationId: null, email: "admin@test.no" },
      },
    });

    requireRoleOr403Mock.mockReturnValue(
      new Response(JSON.stringify({ ok: false, error: "FORBIDDEN" }), { status: 403 })
    );

    const res = await GET(mkReq("http://x/api/superadmin/_gate", { method: "GET" }));
    expect(res.status).toBe(403);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
  });
});

describe("Privilege boundaries — internal scheduler run", () => {
  const origEnv = process.env.CRON_SECRET;

  afterEach(() => {
    if (origEnv !== undefined) process.env.CRON_SECRET = origEnv;
    else delete process.env.CRON_SECRET;
  });

  test("POST returns 403 when cron secret header missing", async () => {
    process.env.CRON_SECRET = "scheduler-secret";
    const { POST } = await import("../../app/api/internal/scheduler/run/route");
    const res = await POST(mkReq("http://x/api/internal/scheduler/run", { method: "POST" }));
    expect(res.status).toBe(403);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("forbidden");
  });

  test("POST returns 500 when CRON_SECRET not set", async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await import("../../app/api/internal/scheduler/run/route");
    const res = await POST(mkReq("http://x/api/internal/scheduler/run", { method: "POST" }));
    expect(res.status).toBe(500);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("misconfigured");
  });
});
