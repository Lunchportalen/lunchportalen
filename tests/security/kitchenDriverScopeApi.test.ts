// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

type ScopeShape = {
  user_id: string;
  email: string;
  role: string;
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

/** Styres i tester: null = ingen Supabase-session (scopeOr401 → 401 etter enrich). */
const authBridge = vi.hoisted(() => ({
  supabaseUser: null as { id: string; email: string } | null,
}));

vi.mock("@/lib/auth/scope", () => ({
  getScope: vi.fn(async () => ({ ...scopeState })),
}));

vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

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
  };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () => {
        const u = authBridge.supabaseUser;
        if (!u) return { data: { user: null }, error: { message: "Auth session missing" } };
        return { data: { user: { id: u.id, email: u.email } }, error: null };
      },
    },
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
    authBridge.supabaseUser = { id: "u1", email: scopeState.email };
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

  test("kitchen uten session (ingen userId etter enrich) -> 401 UNAUTHORIZED — ikke NO_ORDERS / ikke data", async () => {
    scopeState = {
      user_id: "",
      email: "",
      role: "kitchen",
      company_id: null,
      location_id: null,
      is_active: true,
    };
    authBridge.supabaseUser = null;

    const mod = await import("../../app/api/kitchen/route");
    const res = await mod.GET(mkReq("http://localhost/api/kitchen?date=2026-02-16"));
    const body = await readJson(res);

    expect(res.status).toBe(401);
    expect(body?.ok).toBe(false);
    expect(body?.error).toBe("UNAUTHORIZED");
    expect(body?.message).toMatch(/innlogget/i);
  });

  test("driver uten session -> 401 UNAUTHORIZED — ikke tom stops-success", async () => {
    scopeState = {
      user_id: "",
      email: "",
      role: "driver",
      company_id: null,
      location_id: null,
      is_active: true,
    };
    authBridge.supabaseUser = null;

    const mod = await import("../../app/api/driver/stops/route");
    const res = await mod.GET(mkReq("http://localhost/api/driver/stops?date=2026-02-16"));
    const body = await readJson(res);

    expect(res.status).toBe(401);
    expect(body?.ok).toBe(false);
    expect(body?.error).toBe("UNAUTHORIZED");
  });

  const CID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const LID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  test("kitchen API: employee med scope -> 403 FORBIDDEN (ikke kitchen/superadmin) — ingen operativ payload", async () => {
    scopeState = {
      user_id: "u1",
      email: "employee.scope@test.lunchportalen.no",
      role: "employee",
      company_id: CID,
      location_id: LID,
      is_active: true,
    };
    authBridge.supabaseUser = { id: "u1", email: scopeState.email };

    const mod = await import("../../app/api/kitchen/route");
    const res = await mod.GET(mkReq("http://localhost/api/kitchen?date=2026-02-16"));
    const body = await readJson(res);

    expect(res.status).toBe(403);
    expect(body?.error).toBe("FORBIDDEN");
  });

  test("driver API: kitchen-rolle (feil rolle) -> 403 FORBIDDEN — ikke stops-data", async () => {
    scopeState = {
      user_id: "u1",
      email: "kitchen.on.driver.route@test.lunchportalen.no",
      role: "kitchen",
      company_id: CID,
      location_id: LID,
      is_active: true,
    };
    authBridge.supabaseUser = { id: "u1", email: scopeState.email };

    const mod = await import("../../app/api/driver/stops/route");
    const res = await mod.GET(mkReq("http://localhost/api/driver/stops?date=2026-02-16"));
    const body = await readJson(res);

    expect(res.status).toBe(403);
    expect(body?.error).toBe("FORBIDDEN");
  });

  test("driver API: employee-rolle -> 403 FORBIDDEN — ikke tom liste som OK", async () => {
    scopeState = {
      user_id: "u1",
      email: "employee.driver@test.lunchportalen.no",
      role: "employee",
      company_id: CID,
      location_id: LID,
      is_active: true,
    };
    authBridge.supabaseUser = { id: "u1", email: scopeState.email };

    const mod = await import("../../app/api/driver/stops/route");
    const res = await mod.GET(mkReq("http://localhost/api/driver/stops?date=2026-02-16"));
    const body = await readJson(res);

    expect(res.status).toBe(403);
    expect(body?.error).toBe("FORBIDDEN");
  });

  test("kitchen API: driver-rolle (feil rolle for /api/kitchen) -> 403 FORBIDDEN", async () => {
    scopeState = {
      user_id: "u1",
      email: "driver.on.kitchen@test.lunchportalen.no",
      role: "driver",
      company_id: CID,
      location_id: LID,
      is_active: true,
    };
    authBridge.supabaseUser = { id: "u1", email: scopeState.email };

    const mod = await import("../../app/api/kitchen/route");
    const res = await mod.GET(mkReq("http://localhost/api/kitchen?date=2026-02-16"));
    const body = await readJson(res);

    expect(res.status).toBe(403);
    expect(body?.error).toBe("FORBIDDEN");
  });
});
