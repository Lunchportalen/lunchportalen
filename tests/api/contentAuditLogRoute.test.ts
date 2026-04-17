/**
 * U30 — audit-log degradert respons når content_audit_log mangler (ikke 500).
 */
import { describe, expect, test, vi, beforeEach } from "vitest";

function mkReq(url: string) {
  return new Request(url, { method: "GET" }) as import("next/server").NextRequest;
}

const scopeOr401Mock = vi.hoisted(() => vi.fn());
const requireRoleOr403Mock = vi.hoisted(() => vi.fn());
const mockAuditQueryError = vi.hoisted(() => ({
  current: { code: "42P01", message: 'relation "content_audit_log" does not exist' } as {
    code?: string;
    message: string;
  } | null,
}));

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: requireRoleOr403Mock,
  q: (req: Request, key: string) => new URL(req.url).searchParams.get(key),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () =>
            Promise.resolve({
              data: null,
              error: mockAuditQueryError.current,
            }),
        }),
      }),
    }),
  }),
}));

describe("GET /api/backoffice/content/audit-log — degraded when table missing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditQueryError.current = { code: "42P01", message: 'relation "content_audit_log" does not exist' };
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: "rid_t", scope: { role: "superadmin", userId: "u1", companyId: null, locationId: null } },
    });
    requireRoleOr403Mock.mockReturnValue(null);
  });

  test("returns 200 with empty items and degraded when relation missing", async () => {
    const { GET } = await import("@/app/api/backoffice/content/audit-log/route");
    const res = await GET(mkReq("http://localhost/api/backoffice/content/audit-log?limit=10"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok?: boolean;
      data?: {
        items?: unknown[];
        degraded?: boolean;
        reason?: string;
        historyStatus?: string;
        operatorMessage?: string;
        operatorAction?: string;
        schemaHints?: { tableMissing?: boolean; detail?: string };
      };
    };
    expect(body.ok).toBe(true);
    expect(body.data?.degraded).toBe(true);
    expect(Array.isArray(body.data?.items)).toBe(true);
    expect(body.data?.items?.length).toBe(0);
    expect(body.data?.reason).toBe("TABLE_MISSING");
    expect(body.data?.historyStatus).toBe("degraded");
    expect(body.data?.operatorMessage).toContain("Audit-logg er degradert");
    expect(body.data?.operatorAction).toContain("content_audit_log");
    expect(body.data?.schemaHints?.tableMissing).toBe(true);
    expect(body.data?.schemaHints?.detail).toContain("content_audit_log");
  });

  test("returns degraded column-missing payload with code when audit schema drifts", async () => {
    mockAuditQueryError.current = {
      code: "42703",
      message: 'column "actor_email" of relation "content_audit_log" does not exist',
    };
    const { GET } = await import("@/app/api/backoffice/content/audit-log/route");
    const res = await GET(mkReq("http://localhost/api/backoffice/content/audit-log?limit=10"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok?: boolean;
      data?: {
        degraded?: boolean;
        reason?: string;
        schemaHints?: { columnMissing?: boolean; code?: string | null; detail?: string };
      };
    };
    expect(body.ok).toBe(true);
    expect(body.data?.degraded).toBe(true);
    expect(body.data?.reason).toBe("COLUMN_MISSING");
    expect(body.data?.schemaHints?.columnMissing).toBe(true);
    expect(body.data?.schemaHints?.code).toBe("42703");
    expect(body.data?.schemaHints?.detail).toContain("actor_email");
  });

  test("returns 422 when page_id filter is not a UUID", async () => {
    const { GET } = await import("@/app/api/backoffice/content/audit-log/route");
    const res = await GET(mkReq("http://localhost/api/backoffice/content/audit-log?page_id=not-a-uuid"));
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      ok?: boolean;
      error?: string;
      message?: string;
      status?: number;
    };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("INVALID_PAGE_ID");
    expect(body.message).toContain("page_id");
  });
});
