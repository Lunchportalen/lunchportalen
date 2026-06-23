/**
 * Provider menu-days API: auth, provider scoping, sanitized response.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const PROVIDER_ID = "22222222-2222-2222-2222-222222222222";

const mockGetAuthContext = vi.hoisted(() => vi.fn());
const mockGetProviderAdminContext = vi.hoisted(() => vi.fn());
const mockHasProviderRole = vi.hoisted(() => vi.fn());
const mockRequireSanityWrite = vi.hoisted(() => vi.fn());
const mockSync = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/menu-publish/syncMenuServiceDaysFromMenuDay", () => ({
  syncMenuServiceDaysForPublishedMenuDay: (...args: unknown[]) => mockSync(...args),
  deleteMenuServiceDaysForMenuDay: (...args: unknown[]) => mockDelete(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({}),
}));

const mockLoadMenuDays = vi.hoisted(() => vi.fn());
const mockLoadPrices = vi.hoisted(() => vi.fn());

vi.mock("@/lib/provider-menu/loadProviderMenuDays", () => ({
  loadProviderMenuDaysForDates: (...args: unknown[]) => mockLoadMenuDays(...args),
  loadProviderMenuDaySlot: (...args: unknown[]) => mockLoadMenuDaySlot(...args),
}));

const mockLoadMenuDaySlot = vi.hoisted(() => vi.fn());
const mockFetchLunchCategories = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cms/lunchCategory", () => ({
  fetchLunchCategoryRowsForProvider: (...args: unknown[]) => mockFetchLunchCategories(...args),
  fetchLunchCategoryTemplateRows: (...args: unknown[]) => mockFetchLunchCategories(...args),
  fetchActiveLunchCategoryRows: (...args: unknown[]) => mockFetchLunchCategories(...args),
}));

vi.mock("@/lib/providers/providerMenuPriceConfig", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/providers/providerMenuPriceConfig")>();
  return {
    ...actual,
    loadProviderMenuPrices: (...args: unknown[]) => mockLoadPrices(...args),
  };
});

const mockLoadPreview = vi.hoisted(() => vi.fn());
const mockIsPreviewEnabled = vi.hoisted(() => vi.fn());

vi.mock("@/lib/providers/providerMenuPricePreviewFlag", () => ({
  isProviderMenuPricePreviewDisplayEnabled: () => mockIsPreviewEnabled(),
}));

vi.mock("@/lib/providers/providerMenuPricePreview", () => ({
  loadProviderMenuPricesPreview: (...args: unknown[]) => mockLoadPreview(...args),
}));

function mkReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/provider/menu-days", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

const validBody = {
  date: "2026-06-16",
  tier: "BASIS",
  category: "varmrett",
  mealTitle: "Kyllinggryte",
  description: "Med rotgrønnsaker.",
  status: "published",
};

function authedProvider() {
  mockGetAuthContext.mockResolvedValue({
    ok: true,
    user: { id: "user-1", email: "chef@provider.no" },
  });
  mockGetProviderAdminContext.mockResolvedValue({
    primaryProvider: {
      id: PROVIDER_ID,
      name: "Provider B AS",
      slug: "provider-b",
    },
  });
  mockHasProviderRole.mockResolvedValue(true);
  mockRequireSanityWrite.mockReturnValue({
    createOrReplace: vi.fn(async (doc: { _id: string; provider: { _ref: string } }) => doc),
  });
  mockSync.mockResolvedValue({ skipped: false, inserted: 1, updated: 0, unchanged: 0, locationCount: 1 });
  mockDelete.mockResolvedValue({ deleted: 0 });
}

describe("POST /api/provider/menu-days", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadMenuDaySlot.mockResolvedValue(null);
  });

  test("unauthenticated request rejected", async () => {
    mockGetAuthContext.mockResolvedValue({ ok: false, user: null });
    const { POST } = await import("@/app/api/provider/menu-days/route");
    const res = await POST(mkReq(validBody) as any);
    expect(res.status).toBe(401);
  });

  test("user without provider membership rejected", async () => {
    mockGetAuthContext.mockResolvedValue({
      ok: true,
      user: { id: "user-1", email: "x@y.no" },
    });
    mockGetProviderAdminContext.mockResolvedValue({ primaryProvider: null });
    const { POST } = await import("@/app/api/provider/menu-days/route");
    const res = await POST(mkReq(validBody) as any);
    expect(res.status).toBe(403);
  });

  test("viewer without kitchen role rejected", async () => {
    mockGetAuthContext.mockResolvedValue({
      ok: true,
      user: { id: "user-1", email: "viewer@provider.no" },
    });
    mockGetProviderAdminContext.mockResolvedValue({
      primaryProvider: { id: PROVIDER_ID, name: "P", slug: "p" },
    });
    mockHasProviderRole.mockResolvedValue(false);
    const { POST } = await import("@/app/api/provider/menu-days/route");
    const res = await POST(mkReq(validBody) as any);
    expect(res.status).toBe(403);
  });

  test("client-supplied providerId ignored — payload uses server provider", async () => {
    authedProvider();
    const createOrReplace = vi.fn(async (doc) => doc);
    mockRequireSanityWrite.mockReturnValue({ createOrReplace });

    const { POST } = await import("@/app/api/provider/menu-days/route");
    const res = await POST(
      mkReq({ ...validBody, providerId: "evil-11111111-1111-1111-1111-111111111111" }) as any,
    );
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(createOrReplace).toHaveBeenCalledTimes(1);
    const written = createOrReplace.mock.calls[0][0];
    expect(written.provider._ref).toBe(PROVIDER_ID);
    expect(json.data.id).toBe(`menuDay-${PROVIDER_ID}-2026-06-16-BASIS-varmrett`);
    expect(json.data.providerSlug).toBe("provider-b");
    expect(json.data.approvedForPublish).toBe(true);
    expect(json.data.customerVisible).toBe(true);
  });

  test("draft sets publish flags false and skips sync", async () => {
    authedProvider();
    const { POST } = await import("@/app/api/provider/menu-days/route");
    const res = await POST(mkReq({ ...validBody, status: "draft" }) as any);
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.data.approvedForPublish).toBe(false);
    expect(json.data.customerVisible).toBe(false);
    expect(json.data.syncStatus).toBe("skipped_draft");
    expect(mockSync).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalled();
  });

  test("returns sanitized response only — no token or raw Sanity errors", async () => {
    authedProvider();
    const { POST } = await import("@/app/api/provider/menu-days/route");
    const res = await POST(mkReq(validBody) as any);
    const json = await readJson(res);
    const text = JSON.stringify(json);

    expect(json.ok).toBe(true);
    expect(json.data).toMatchObject({
      id: expect.any(String),
      providerSlug: "provider-b",
      providerName: "Provider B AS",
      date: "2026-06-16",
      tier: "BASIS",
      category: "varmrett",
      mealTitle: "Kyllinggryte",
      status: "published",
      syncStatus: expect.any(String),
    });
    expect(text).not.toMatch(/SANITY_WRITE_TOKEN/i);
    expect(text).not.toMatch(/sk_/);
    expect(json.data.token).toBeUndefined();
  });

  test("invalid tier rejected", async () => {
    authedProvider();
    const { POST } = await import("@/app/api/provider/menu-days/route");
    const res = await POST(mkReq({ ...validBody, tier: "INVALID" }) as any);
    expect(res.status).toBe(422);
  });
});

function mkGetReq(weekStart?: string) {
  const url = new URL("http://localhost/api/provider/menu-days");
  if (weekStart) url.searchParams.set("weekStart", weekStart);
  return { nextUrl: url } as any;
}

function authedViewer() {
  mockGetAuthContext.mockResolvedValue({
    ok: true,
    user: { id: "user-1", email: "viewer@provider.no" },
  });
  mockGetProviderAdminContext.mockResolvedValue({
    primaryProvider: {
      id: PROVIDER_ID,
      name: "Provider B AS",
      slug: "provider-b",
    },
  });
  mockHasProviderRole.mockResolvedValue(true);
  mockLoadMenuDays.mockResolvedValue([]);
  mockLoadPrices.mockResolvedValue({
    BASIS: { tier: "BASIS", priceExVatNok: 90, vatRate: 0.15, priceIncVatNok: 103.5, source: "fallback" },
    LUXUS: { tier: "LUXUS", priceExVatNok: 130, vatRate: 0.15, priceIncVatNok: 149.5, source: "fallback" },
    ENTERPRISE: {
      tier: "ENTERPRISE",
      priceExVatNok: 170,
      vatRate: 0.15,
      priceIncVatNok: 195.5,
      source: "fallback",
    },
  });
  mockFetchLunchCategories.mockResolvedValue([
    {
      key: "paasmurt",
      title: "Påsmurt",
      allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
      items: [{ slug: { current: "ost-skinke" }, title: "Ost & Skinke", allergens: ["hvete", "melk"] }],
    },
  ]);
}

describe("GET /api/provider/menu-days", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadMenuDaySlot.mockResolvedValue(null);
    mockIsPreviewEnabled.mockReturnValue(false);
  });

  test("unauthenticated request rejected", async () => {
    mockGetAuthContext.mockResolvedValue({ ok: false, user: null });
    mockIsPreviewEnabled.mockReturnValue(true);
    const { GET } = await import("@/app/api/provider/menu-days/route");
    const res = await GET(mkGetReq("2026-06-15") as any);
    expect(res.status).toBe(401);
    expect(mockLoadPreview).not.toHaveBeenCalled();
  });

  test("returns week items and prices for scoped provider", async () => {
    authedViewer();
    mockLoadMenuDays.mockResolvedValue([
      {
        id: `menuDay-${PROVIDER_ID}-2026-06-16-BASIS-varmrett`,
        date: "2026-06-16",
        tier: "BASIS",
        category: "varmrett",
        mealTitle: "Kyllinggryte",
        description: "Med rotgrønnsaker.",
        allergens: ["melk"],
        estimatedCostPerPortion: 35,
        sourcePackage: null,
        upgradeType: null,
        upgradeNote: null,
        status: "published",
      },
    ]);

    const { GET } = await import("@/app/api/provider/menu-days/route");
    const res = await GET(mkGetReq("2026-06-15") as any);
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.weekStart).toBe("2026-06-15");
    expect(json.data.dates).toHaveLength(5);
    expect(json.data.providerId).toBe(PROVIDER_ID);
    expect(json.data.prices.BASIS.priceExVatNok).toBe(90);
    expect(json.data.prices.ENTERPRISE.priceIncVatNok).toBe(195.5);
    expect(json.data.pricePreview).toBeUndefined();
    expect(mockLoadMenuDays).toHaveBeenCalledWith(PROVIDER_ID, expect.any(Array), {
      providerSlug: "provider-b",
    });
    expect(mockLoadPrices).toHaveBeenCalledWith(PROVIDER_ID);
    expect(mockLoadPreview).not.toHaveBeenCalled();
    expect(mockFetchLunchCategories).toHaveBeenCalled();
    expect(json.data.catalog).toMatchObject({ rows: expect.any(Array) });
  });

  test("flag off: no pricePreview in response", async () => {
    authedViewer();
    mockIsPreviewEnabled.mockReturnValue(false);

    const { GET } = await import("@/app/api/provider/menu-days/route");
    const res = await GET(mkGetReq("2026-06-15") as any);
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.data.prices.BASIS.priceExVatNok).toBe(90);
    expect(json.data.pricePreview).toBeUndefined();
    expect(mockLoadPreview).not.toHaveBeenCalled();
  });

  test("flag on: returns pricePreview while prices remain production", async () => {
    authedViewer();
    mockIsPreviewEnabled.mockReturnValue(true);
    mockLoadPreview.mockResolvedValue({
      tiers: {
        BASIS: {
          tier: "BASIS",
          amountExVat: 95,
          priceIncVatNok: 109.25,
          currency: "NOK",
          vatRate: 0.15,
          taxBasis: "ex_tax",
          taxCategory: "food_catering",
          marketCode: "NO",
          source: "provider_price_rules_market",
          validFrom: null,
          validTo: null,
          rowSource: "seed",
        },
        LUXUS: {
          tier: "LUXUS",
          amountExVat: 130,
          priceIncVatNok: 149.5,
          currency: "NOK",
          vatRate: 0.15,
          taxBasis: "ex_tax",
          taxCategory: "food_catering",
          marketCode: "NO",
          source: "provider_price_rules_market",
          validFrom: null,
          validTo: null,
          rowSource: "seed",
        },
        ENTERPRISE: {
          tier: "ENTERPRISE",
          amountExVat: 170,
          priceIncVatNok: 195.5,
          currency: "NOK",
          vatRate: 0.15,
          taxBasis: "ex_tax",
          taxCategory: "food_catering",
          marketCode: "NO",
          source: "provider_price_rules_market",
          validFrom: null,
          validTo: null,
          rowSource: "seed",
        },
      },
      diagnostics: {
        preview: true,
        resolverVersion: "r4d-preview-v1",
        providerId: PROVIDER_ID,
        marketCode: "NO",
        aggregateSource: "provider_price_rules_market",
        dbRowCount: 3,
        tiersFromMarket: 3,
        tiersFromFallback: 0,
        skippedInvalidRows: 0,
      },
    });

    const { GET } = await import("@/app/api/provider/menu-days/route");
    const res = await GET(mkGetReq("2026-06-15") as any);
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(mockLoadPreview).toHaveBeenCalledTimes(1);
    expect(mockLoadPreview).toHaveBeenCalledWith(PROVIDER_ID);
    expect(json.data.prices.BASIS.priceExVatNok).toBe(90);
    expect(json.data.prices.ENTERPRISE.priceIncVatNok).toBe(195.5);
    expect(json.data.pricePreview.preview).toBe(true);
    expect(json.data.pricePreview.marketCode).toBe("NO");
    expect(json.data.pricePreview.tiers.BASIS.amountExVat).toBe(95);
    expect(json.data.pricePreview.tiers.BASIS.taxBasis).toBe("ex_tax");
    expect(json.data.pricePreview.tiers.BASIS.differsFromProduction).toBe(true);
    expect(json.data.pricePreview.tiers.LUXUS.differsFromProduction).toBe(false);
    expect(json.data.pricePreview.tiers.ENTERPRISE.differsFromProduction).toBe(false);
  });
});
