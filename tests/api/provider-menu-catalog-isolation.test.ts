/**
 * Provider menu-catalog API: auth, provider_admin gate, isolation.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const PROVIDER_A = "11111111-1111-1111-1111-111111111111";
const PROVIDER_B = "22222222-2222-2222-2222-222222222222";

const mockGetAuthContext = vi.hoisted(() => vi.fn());
const mockGetProviderAdminContext = vi.hoisted(() => vi.fn());
const mockHasProviderRole = vi.hoisted(() => vi.fn());
const mockRequireSanityWrite = vi.hoisted(() => vi.fn());
const mockPersist = vi.hoisted(() => vi.fn());
const mockFetchRows = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: () => mockGetAuthContext(),
}));

vi.mock("@/lib/auth/providerContext", () => ({
  getProviderAdminContext: (userId: string) => mockGetProviderAdminContext(userId),
}));

vi.mock("@/lib/auth/provider", () => ({
  hasProviderRole: (...args: unknown[]) => mockHasProviderRole(...args),
}));

vi.mock("@/lib/sanity/client", () => ({
  requireSanityWrite: () => mockRequireSanityWrite(),
}));

vi.mock("@/lib/cms/lunchCategory", () => ({
  fetchLunchCategoryRowsForProvider: (...args: unknown[]) => mockFetchRows(...args),
}));

vi.mock("@/lib/provider-menu/menuCatalogWrite", () => ({
  persistProviderMenuCatalog: (...args: unknown[]) => mockPersist(...args),
  MenuCatalogWriteError: class MenuCatalogWriteError extends Error {
    field?: string;
    constructor(message: string, field?: string) {
      super(message);
      this.field = field;
    }
  },
  CATALOG_WEEK_PUBLISH_HINT: "hint",
}));

function authedAdmin(providerId = PROVIDER_A) {
  mockGetAuthContext.mockResolvedValue({
    ok: true,
    user: { id: "admin-user", email: "admin@provider.no" },
  });
  mockGetProviderAdminContext.mockResolvedValue({
    primaryProvider: {
      id: providerId,
      name: "Provider A",
      slug: "provider-a",
    },
  });
  mockHasProviderRole.mockImplementation(async (_uid: string, pid: string, role: string) => {
    if (role === "provider_viewer") return true;
    if (role === "provider_admin") return pid === providerId;
    return false;
  });
  mockRequireSanityWrite.mockReturnValue({ createOrReplace: vi.fn() });
  mockFetchRows.mockResolvedValue([{ key: "paasmurt", items: [] }]);
  mockPersist.mockResolvedValue({ catalog: { rows: [{ key: "paasmurt", items: [] }] } });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

describe("POST /api/provider/menu-catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("kitchen role cannot write catalog", async () => {
    mockGetAuthContext.mockResolvedValue({
      ok: true,
      user: { id: "kitchen-user", email: "kitchen@provider.no" },
    });
    mockGetProviderAdminContext.mockResolvedValue({
      primaryProvider: { id: PROVIDER_A, name: "A", slug: "provider-a" },
    });
    mockHasProviderRole.mockImplementation(async (_uid: string, _pid: string, role: string) => {
      if (role === "provider_viewer") return true;
      if (role === "provider_kitchen") return true;
      if (role === "provider_admin") return false;
      return false;
    });

    const { POST } = await import("@/app/api/provider/menu-catalog/route");
    const res = await POST(
      new Request("http://localhost/api/provider/menu-catalog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categoryKey: "paasmurt",
          items: [{ key: "ost-skinke", title: "Ost & Skinke" }],
        }),
      }) as any,
    );
    expect(res.status).toBe(403);
  });

  test("provider_admin saves with server-resolved provider", async () => {
    authedAdmin(PROVIDER_A);
    const { POST } = await import("@/app/api/provider/menu-catalog/route");
    const res = await POST(
      new Request("http://localhost/api/provider/menu-catalog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categoryKey: "paasmurt",
          providerId: PROVIDER_B,
          items: [{ key: "ost-skinke", title: "Ost & Skinke" }],
        }),
      }) as any,
    );
    const json = await readJson(res);
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockPersist).toHaveBeenCalledWith(expect.anything(), PROVIDER_A, {
      categoryKey: "paasmurt",
      items: [{ key: "ost-skinke", title: "Ost & Skinke", allergens: [], isVegetarian: false, description: null }],
    });
  });

  test("GET returns provider-scoped catalog", async () => {
    authedAdmin(PROVIDER_A);
    const { GET } = await import("@/app/api/provider/menu-catalog/route");
    const res = await GET({ nextUrl: new URL("http://localhost/api/provider/menu-catalog") } as any);
    const json = await readJson(res);
    expect(res.status).toBe(200);
    expect(mockFetchRows).toHaveBeenCalledWith(PROVIDER_A);
    expect(json.data.catalog).toBeDefined();
  });
});

describe("provider menu-catalog isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("provider A fetch never requests B id", async () => {
    authedAdmin(PROVIDER_A);
    const { GET } = await import("@/app/api/provider/menu-catalog/route");
    await GET({ nextUrl: new URL("http://localhost/api/provider/menu-catalog") } as any);
    expect(mockFetchRows).toHaveBeenCalledWith(PROVIDER_A);
    expect(mockFetchRows).not.toHaveBeenCalledWith(PROVIDER_B);
  });

  test("write always targets session provider not body providerId", async () => {
    authedAdmin(PROVIDER_A);
    const { POST } = await import("@/app/api/provider/menu-catalog/route");
    await POST(
      new Request("http://localhost/api/provider/menu-catalog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categoryKey: "paasmurt",
          providerId: PROVIDER_B,
          items: [{ title: "Ny", allergens: [] }],
        }),
      }) as any,
    );
    expect(mockPersist.mock.calls[0]?.[1]).toBe(PROVIDER_A);
  });
});
