// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

type ScopeShape = {
  user_id: string;
  email: string;
  role: "kitchen" | "driver";
  company_id: string | null;
  location_id: string | null;
  is_active: boolean;
};

let scopeState: ScopeShape = {
  user_id: "u1",
  email: "kitchen.scope@test.lunchportalen.no",
  role: "kitchen",
  company_id: null,
  location_id: null,
  is_active: true,
};

vi.mock("@/lib/auth/scope", () => ({
  getScope: vi.fn(async () => ({ ...scopeState })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => ({ then: (resolve: any) => resolve({ data: [], error: null }) }),
          neq: () => ({ then: (resolve: any) => resolve({ data: [], error: null }) }),
          order: () => ({ then: (resolve: any) => resolve({ data: [], error: null }) }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: scopeState.email } }, error: null }) },
  }),
}));

function mkReq(url: string, init?: RequestInit) {
  return new Request(url, init) as any;
}

async function readJson(res: Response) {
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
}

describe("API guard: kitchen/driver scope enforcement", () => {
  beforeEach(() => {
    scopeState = {
      user_id: "u1",
      email: "kitchen.scope@test.lunchportalen.no",
      role: "kitchen",
      company_id: null,
      location_id: null,
      is_active: true,
    };
    vi.resetModules();
  });

  test("kitchen without assignment -> 403 SCOPE_NOT_ASSIGNED", async () => {
    scopeState.role = "kitchen";
    scopeState.company_id = null;
    scopeState.location_id = null;

    const mod = await import("../../app/api/kitchen/route");
    const res = await mod.GET(mkReq("http://localhost/api/kitchen?date=2026-02-16"));
    const body = await readJson(res);

    expect(res.status).toBe(403);
    expect(body?.error).toBe("SCOPE_NOT_ASSIGNED");
  });

  test("driver without assignment -> 403 SCOPE_NOT_ASSIGNED", async () => {
    scopeState.role = "driver";
    scopeState.email = "driver.scope@test.lunchportalen.no";
    scopeState.company_id = null;
    scopeState.location_id = null;

    const mod = await import("../../app/api/driver/stops/route");
    const res = await mod.GET(mkReq("http://localhost/api/driver/stops?date=2026-02-16"));
    const body = await readJson(res);

    expect(res.status).toBe(403);
    expect(body?.error).toBe("SCOPE_NOT_ASSIGNED");
  });
});
