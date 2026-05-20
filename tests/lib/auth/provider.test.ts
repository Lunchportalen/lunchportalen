import { describe, expect, test, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

import type { ProviderMembership } from "@/lib/providers/types";
import { scopeOr401 } from "@/lib/http/routeGuard";

const { MELHUS, USER, scopeCtx } = vi.hoisted(() => {
  const uid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const melhus = "11111111-1111-1111-1111-111111111111";
  return {
    MELHUS: melhus,
    USER: uid,
    scopeCtx: {
      rid: "rid_test",
      route: "/api/leverandor/test",
      method: "GET",
      scope: {
        userId: uid,
        role: "provider_admin",
        companyId: null,
        locationId: null,
        email: "a@b.no",
        sub: uid,
      },
    },
  };
});

const membershipAdmin: ProviderMembership = {
  id: "m1",
  userId: USER,
  providerId: MELHUS,
  role: "provider_admin",
  createdAt: "2026-01-01T00:00:00Z",
};

const membershipKitchen: ProviderMembership = {
  id: "m2",
  userId: USER,
  providerId: MELHUS,
  role: "provider_kitchen",
  createdAt: "2026-01-02T00:00:00Z",
};

const membershipViewer: ProviderMembership = {
  id: "m3",
  userId: USER,
  providerId: MELHUS,
  role: "provider_viewer",
  createdAt: "2026-01-03T00:00:00Z",
};

let membershipRows: ProviderMembership[] = [membershipAdmin];
let superadmin = false;
let authUser: { id: string; email: string } | null = { id: USER, email: "admin@melhus.no" };

function membershipQuery() {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(async () => ({
          data: membershipRows.map((m) => ({
            id: m.id,
            user_id: m.userId,
            provider_id: m.providerId,
            role: m.role,
            created_at: m.createdAt,
          })),
          error: null,
        })),
      })),
    })),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: authUser },
        error: null,
      })),
    },
    from: vi.fn((table: string) => {
      if (table === "provider_memberships") return membershipQuery();
      if (table === "providers") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: MELHUS,
                    name: "Melhus",
                    slug: "melhus",
                    org_number: null,
                    status: "ACTIVE",
                    contact_email: "kontakt@melhus.no",
                    contact_phone: null,
                    logo_url: null,
                    primary_color: null,
                    description: null,
                    billing_model: "SAAS_FIXED",
                    created_at: "2026-01-01T00:00:00Z",
                    updated_at: "2026-01-01T00:00:00Z",
                    suspended_at: null,
                    suspended_by: null,
                    suspended_reason: null,
                    paused_at: null,
                    paused_by: null,
                    paused_reason: null,
                    deleted_at: null,
                  },
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      return membershipQuery();
    }),
  })),
}));

vi.mock("@/lib/auth/isSuperadminProfile", () => ({
  isSuperadminProfile: vi.fn(async () => superadmin),
}));

vi.mock("@/lib/http/routeGuard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http/routeGuard")>();
  return {
    ...actual,
    scopeOr401: vi.fn(async () => ({ ok: true as const, ctx: scopeCtx })),
    readJson: vi.fn(async () => ({})),
  };
});

beforeEach(() => {
  membershipRows = [membershipAdmin];
  superadmin = false;
  authUser = { id: USER, email: "admin@melhus.no" };
  vi.clearAllMocks();
  vi.mocked(scopeOr401).mockResolvedValue({ ok: true, ctx: scopeCtx } as any);
});

describe("providerRoleSatisfies (hierarchy)", () => {
  test.each([
    ["provider_admin", "provider_viewer", true],
    ["provider_admin", "provider_kitchen", true],
    ["provider_admin", "provider_admin", true],
    ["provider_kitchen", "provider_viewer", true],
    ["provider_kitchen", "provider_kitchen", true],
    ["provider_kitchen", "provider_admin", false],
    ["provider_viewer", "provider_viewer", true],
    ["provider_viewer", "provider_kitchen", false],
    ["provider_viewer", "provider_admin", false],
  ] as const)("actual=%s required=%s → %s", async (actual, required, expected) => {
    const { providerRoleSatisfies } = await import("@/lib/auth/provider");
    expect(providerRoleSatisfies(actual, required)).toBe(expected);
  });

  test("null actual → false", async () => {
    const { providerRoleSatisfies } = await import("@/lib/auth/provider");
    expect(providerRoleSatisfies(null, "provider_viewer")).toBe(false);
  });
});

describe("getProviderMemberships", () => {
  test("returns mapped memberships array", async () => {
    membershipRows = [membershipAdmin, membershipKitchen];
    const { getProviderMemberships } = await import("@/lib/auth/provider");
    const rows = await getProviderMemberships(USER);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ userId: USER, providerId: MELHUS, role: "provider_admin" });
  });

  test("empty userId → empty array", async () => {
    const { getProviderMemberships } = await import("@/lib/auth/provider");
    expect(await getProviderMemberships("")).toEqual([]);
  });
});

describe("getProviderRole", () => {
  test("returns role when membership exists", async () => {
    membershipRows = [membershipKitchen];
    const { getProviderRole } = await import("@/lib/auth/provider");
    expect(await getProviderRole(USER, MELHUS)).toBe("provider_kitchen");
  });

  test("returns null without membership", async () => {
    membershipRows = [];
    const { getProviderRole } = await import("@/lib/auth/provider");
    expect(await getProviderRole(USER, MELHUS)).toBeNull();
  });
});

describe("hasProviderRole", () => {
  test("provider_admin satisfies provider_kitchen", async () => {
    membershipRows = [membershipAdmin];
    const { hasProviderRole } = await import("@/lib/auth/provider");
    expect(await hasProviderRole(USER, MELHUS, "provider_kitchen")).toBe(true);
  });

  test("provider_viewer does not satisfy provider_kitchen", async () => {
    membershipRows = [membershipViewer];
    const { hasProviderRole } = await import("@/lib/auth/provider");
    expect(await hasProviderRole(USER, MELHUS, "provider_kitchen")).toBe(false);
  });
});

describe("canAccessProvider", () => {
  test("true with membership", async () => {
    membershipRows = [membershipViewer];
    const { canAccessProvider } = await import("@/lib/auth/provider");
    expect(await canAccessProvider(USER, MELHUS)).toBe(true);
  });

  test("true for superadmin without membership", async () => {
    membershipRows = [];
    superadmin = true;
    const { canAccessProvider } = await import("@/lib/auth/provider");
    expect(await canAccessProvider(USER, MELHUS)).toBe(true);
  });

  test("false without membership and not superadmin", async () => {
    membershipRows = [];
    superadmin = false;
    const { canAccessProvider } = await import("@/lib/auth/provider");
    expect(await canAccessProvider(USER, MELHUS)).toBe(false);
  });
});

describe("mustProviderId", () => {
  test("returns provider_id from record", async () => {
    const { mustProviderId } = await import("@/lib/auth/withProviderRole");
    expect(mustProviderId({ provider_id: MELHUS })).toBe(MELHUS);
  });

  test("returns providerId camelCase alias", async () => {
    const { mustProviderId } = await import("@/lib/auth/withProviderRole");
    expect(mustProviderId({ providerId: MELHUS })).toBe(MELHUS);
  });

  test("throws ProviderIdMissingError when missing", async () => {
    const { mustProviderId, ProviderIdMissingError } = await import("@/lib/auth/withProviderRole");
    expect(() => mustProviderId({})).toThrow(ProviderIdMissingError);
  });

  test("reads from URLSearchParams", async () => {
    const { mustProviderId } = await import("@/lib/auth/withProviderRole");
    const q = new URLSearchParams({ provider_id: MELHUS });
    expect(mustProviderId(q)).toBe(MELHUS);
  });
});

describe("requireProviderRole", () => {
  test("throws ProviderForbiddenError when role insufficient", async () => {
    membershipRows = [membershipViewer];
    const { requireProviderRole, ProviderForbiddenError } = await import("@/lib/auth/withProviderRole");
    await expect(requireProviderRole(MELHUS, "provider_admin")).rejects.toThrow(ProviderForbiddenError);
  });

  test("resolves when role sufficient", async () => {
    membershipRows = [membershipAdmin];
    const { requireProviderRole } = await import("@/lib/auth/withProviderRole");
    await expect(requireProviderRole(MELHUS, "provider_kitchen")).resolves.toBeUndefined();
  });

  test("throws when not authenticated", async () => {
    authUser = null;
    const { requireProviderRole, ProviderForbiddenError } = await import("@/lib/auth/withProviderRole");
    await expect(requireProviderRole(MELHUS, "provider_viewer")).rejects.toThrow(ProviderForbiddenError);
  });
});

describe("withProviderRole", () => {
  function mkReq(url: string, init?: RequestInit) {
    return new Request(url, init) as NextRequest;
  }

  async function readJson(res: Response) {
    return res.json() as Promise<{ ok: boolean; status?: number; error?: string }>;
  }

  test("401 without session", async () => {
    vi.mocked(scopeOr401).mockResolvedValueOnce({
      ok: false,
      res: new Response(JSON.stringify({ ok: false, error: "UNAUTHORIZED" }), { status: 401 }),
      response: new Response(JSON.stringify({ ok: false }), { status: 401 }),
      ctx: scopeCtx,
    } as any);

    const { withProviderRole } = await import("@/lib/auth/withProviderRole");
    const handler = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const wrapped = withProviderRole("provider_viewer", handler);
    const res = await wrapped(mkReq(`http://localhost/api/test?provider_id=${MELHUS}`, { method: "GET" }));
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  test("403 when role insufficient", async () => {
    membershipRows = [membershipViewer];
    const { withProviderRole } = await import("@/lib/auth/withProviderRole");
    const handler = vi.fn();
    const wrapped = withProviderRole("provider_admin", handler);
    const res = await wrapped(
      mkReq(`http://localhost/api/test?provider_id=${MELHUS}`, { method: "GET" }),
    );
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  test("400 when provider_id missing", async () => {
    const { withProviderRole } = await import("@/lib/auth/withProviderRole");
    const handler = vi.fn();
    const wrapped = withProviderRole("provider_viewer", handler);
    const res = await wrapped(mkReq("http://localhost/api/test", { method: "GET" }));
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
  });

  test("success passes providerId to handler", async () => {
    membershipRows = [membershipAdmin];
    const { withProviderRole } = await import("@/lib/auth/withProviderRole");
    const handler = vi.fn(async (ctx) => {
      expect(ctx.providerId).toBe(MELHUS);
      return new Response(JSON.stringify({ ok: true, providerId: ctx.providerId }), { status: 200 });
    });
    const wrapped = withProviderRole("provider_kitchen", handler);
    const res = await wrapped(
      mkReq(`http://localhost/api/test?provider_id=${MELHUS}`, { method: "GET" }),
    );
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
});

describe("getProviderAdminContext", () => {
  test("returns user, memberships, primaryProvider and role", async () => {
    membershipRows = [membershipKitchen, membershipAdmin];
    const { getProviderAdminContext } = await import("@/lib/auth/providerContext");
    const ctx = await getProviderAdminContext(USER);
    expect(ctx.user.id).toBe(USER);
    expect(ctx.memberships.length).toBeGreaterThan(0);
    expect(ctx.primaryProvider?.id).toBe(MELHUS);
    expect(ctx.role).toBe("provider_admin");
  });

  test("empty memberships → null primary and role", async () => {
    membershipRows = [];
    const { getProviderAdminContext } = await import("@/lib/auth/providerContext");
    const ctx = await getProviderAdminContext(USER);
    expect(ctx.primaryProvider).toBeNull();
    expect(ctx.role).toBeNull();
  });
});
