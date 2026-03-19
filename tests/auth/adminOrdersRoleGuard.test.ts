// tests/auth/adminOrdersRoleGuard.test.ts
// @ts-nocheck
import { describe, test, expect, vi } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers }) as any;
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

vi.mock("@/lib/auth/scope", () => ({
  getScope: vi.fn(async (_req: any) => ({
    user_id: "u_emp",
    email: "emp@test.no",
    role: "employee",
    company_id: "c_emp",
    location_id: null,
    is_active: true,
  })),
}));

describe("admin/orders role guard", () => {
  test("employee cannot access admin orders API", async () => {
    const { GET } = await import("../../app/api/admin/orders/route");

    const req = mkReq("http://localhost/api/admin/orders?date=2026-01-29&status=ACTIVE", {
      method: "GET",
      headers: {
        "x-mock-role": "employee",
        "x-mock-company": "c_emp",
      },
    });

    const res = await GET(req as any);
    expect(res.status).toBe(403);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
  });
});

