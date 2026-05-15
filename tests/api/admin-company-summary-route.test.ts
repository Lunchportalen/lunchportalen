import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

import { GET } from "@/app/api/admin/company/[companyId]/summary/route";

vi.mock("@/lib/auth/scope", () => ({
  getScope: vi.fn(),
}));

const rpcMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({
    rpc: rpcMock,
  })),
}));

import { getScope } from "@/lib/auth/scope";

function mkReq(url: string) {
  return new Request(url) as unknown as NextRequest;
}

const COMPANY_A = "11111111-1111-1111-1111-111111111111";
const COMPANY_B = "22222222-2222-2222-2222-222222222222";

const adminScope = {
  user_id: "u1",
  email: "a@co.no",
  role: "company_admin" as const,
  company_id: COMPANY_A,
  location_id: null,
  is_active: true,
};

describe("GET /api/admin/company/[companyId]/summary", () => {
  beforeEach(() => {
    vi.mocked(getScope).mockResolvedValue(adminScope as any);
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({
      data: {
        summary: {
          company_id: COMPANY_A,
          total_meal_units: 3,
          active_order_count: 1,
          per_user: [],
        },
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("company_admin for eget firma: 200 og RPC kalles", async () => {
    const res = await GET(
      mkReq(`http://t/api/admin/company/${COMPANY_A}/summary?start=2026-05-01&end=2026-05-31`),
      { params: Promise.resolve({ companyId: COMPANY_A }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith(
      "lp_company_order_summary",
      expect.objectContaining({
        p_company_id: COMPANY_A,
        p_period_start: "2026-05-01",
        p_period_end: "2026-05-31",
      }),
    );
  });

  it("company_admin for annet firma: 403 og ingen RPC", async () => {
    const res = await GET(mkReq(`http://t/api/admin/company/${COMPANY_B}/summary`), {
      params: Promise.resolve({ companyId: COMPANY_B }),
    });
    expect(res.status).toBe(403);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("employee: 403", async () => {
    vi.mocked(getScope).mockResolvedValue({
      ...adminScope,
      role: "employee",
    } as any);
    const res = await GET(mkReq(`http://t/api/admin/company/${COMPANY_A}/summary`), {
      params: Promise.resolve({ companyId: COMPANY_A }),
    });
    expect(res.status).toBe(403);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("ikke innlogget: 401", async () => {
    vi.mocked(getScope).mockResolvedValue({
      user_id: "",
      email: null,
      role: "employee",
      company_id: null,
      location_id: null,
      is_active: false,
    } as any);
    const res = await GET(mkReq(`http://t/api/admin/company/${COMPANY_A}/summary`), {
      params: Promise.resolve({ companyId: COMPANY_A }),
    });
    expect(res.status).toBe(401);
  });

  it("RPC FORBIDDEN: 403", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "FORBIDDEN_NOT_COMPANY_ADMIN", code: "P0001" },
    });
    const res = await GET(
      mkReq(`http://t/api/admin/company/${COMPANY_A}/summary?start=2026-05-01&end=2026-05-31`),
      { params: Promise.resolve({ companyId: COMPANY_A }) },
    );
    expect(res.status).toBe(403);
  });
});
