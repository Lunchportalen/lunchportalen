import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { syncMenuServiceDayItemsAfterMenuDayPublish } from "@/lib/menu-publish/syncMenuServiceDayItems";
import { LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE } from "@/lib/menu-generator/sotMsdiItemMapping";

const mockFetchLunchCategoryRowsForProvider = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cms/lunchCategory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cms/lunchCategory")>();
  return {
    ...actual,
    fetchLunchCategoryRowsForProvider: (...args: unknown[]) => mockFetchLunchCategoryRowsForProvider(...args),
  };
});

vi.mock("@/lib/sanity/server", () => ({
  sanityServer: {
    fetch: vi.fn(),
  },
}));

import { sanityServer } from "@/lib/sanity/server";

const PROVIDER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const BASIS_TIERS = ["BASIS", "LUXUS", "ENTERPRISE"];

function basisLunchRows(items: unknown[] = []) {
  return [
    {
      key: "paasmurt",
      title: "Påsmurt",
      displayOrder: 1,
      allowedPlanTiers: BASIS_TIERS,
      items,
    },
    {
      key: "salatboks",
      title: "Salatboks",
      displayOrder: 2,
      allowedPlanTiers: BASIS_TIERS,
      items: [],
    },
    {
      key: "varmrett",
      title: "Varmrett",
      displayOrder: 6,
      allowedPlanTiers: BASIS_TIERS,
      items: [],
    },
  ];
}

const DANISH_PILOT = "799ba3a2-a127-48a0-87b7-87944a2f42a3";

type Seed = {
  locations: Array<{ id: string; company_id: string }>;
  msds: Array<{ id: string; location_id: string }>;
  categories: Array<{ id: string; name: string }>;
  products: Array<{ id: string; sku: string; category_id: string }>;
  agreementId: string;
  dayTier: string;
  companyProviderId?: string;
};

function makeAdmin(seed: Seed) {
  const upserts: unknown[] = [];
  const api = {
    from(table: string) {
      return createChain(table, seed, upserts);
    },
    getUpserts() {
      return upserts;
    },
  };
  return api as unknown as SupabaseClient<any> & { getUpserts: () => unknown[] };
}

function createChain(table: string, seed: Seed, upserts: unknown[]) {
  const b: {
    select: () => typeof b;
    eq: () => typeof b;
    in: () => typeof b;
    is: () => typeof b;
    order: () => typeof b;
    limit: () => typeof b;
    maybeSingle: () => Promise<{ data: unknown; error: null }>;
    upsert: (rows: unknown) => Promise<{ error: null }>;
    then: (
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  } = {
    select() {
      return b;
    },
    eq() {
      return b;
    },
    in() {
      return b;
    },
    is() {
      return b;
    },
    order() {
      return b;
    },
    limit() {
      return b;
    },
    maybeSingle() {
      if (table === "agreements") {
        return Promise.resolve({ data: { id: seed.agreementId }, error: null });
      }
      if (table === "agreement_delivery_days") {
        return Promise.resolve({ data: { tier: seed.dayTier }, error: null });
      }
      if (table === "companies") {
        return Promise.resolve({
          data: { id: "co1", provider_id: seed.companyProviderId ?? PROVIDER_A },
          error: null,
        });
      }
      if (table === "provider_settings") {
        return Promise.resolve({
          data: { default_country_code: "DK", default_currency: "DKK" },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
    upsert(rows: unknown) {
      if (table === "menu_service_day_items") upserts.push(rows);
      return Promise.resolve({ error: null });
    },
    then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      let payload: { data: unknown; error: null };
      if (table === "company_locations") payload = { data: seed.locations, error: null };
      else if (table === "menu_service_days") payload = { data: seed.msds, error: null };
      else if (table === "product_categories") payload = { data: seed.categories, error: null };
      else if (table === "products") payload = { data: seed.products, error: null };
      else payload = { data: null, error: null };
      return Promise.resolve(payload).then(onFulfilled, onRejected);
    },
  };
  return b;
}

describe("syncMenuServiceDayItemsAfterMenuDayPublish", () => {
  beforeEach(() => {
    mockFetchLunchCategoryRowsForProvider.mockReset();
    (sanityServer.fetch as unknown as { mockReset: () => void }).mockReset();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const seed: Seed = {
    locations: [{ id: "loc1", company_id: "co1" }],
    msds: [{ id: "msd1", location_id: "loc1" }],
    categories: [
      { id: "pc1", name: "Paasmurt" },
      { id: "pc2", name: "Salatboks" },
      { id: "pc3", name: "Varmrett" },
    ],
    products: [
      { id: "pr1", sku: "paasmurt", category_id: "pc1" },
      { id: "pr2", sku: "salatboks", category_id: "pc2" },
      { id: "pr3", sku: "varmrett", category_id: "pc3" },
    ],
    agreementId: "agr1",
    dayTier: "BASIS",
  };

  it("UPSERTer MSDI med tier-pris, VAT 0.15 og snapshots fra Sanity", async () => {
    const varmrettCalls: Array<Record<string, unknown>> = [];
    mockFetchLunchCategoryRowsForProvider.mockResolvedValue(
      basisLunchRows([{ title: "Ost & Skinke", description: "Klassiker", allergens: ["melk"] }]),
    );
    (sanityServer.fetch as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(
      async (q: string, params?: Record<string, unknown>) => {
        if (q.includes("menuDay")) {
          varmrettCalls.push({ query: q, params: params ?? {} });
          return {
            mealTitle: "Dagens varmrett",
            meal: { title: "Laks", description: "Med ris", allergens: ["fisk"] },
          };
        }
        return null;
      },
    );

    const admin = makeAdmin(seed);
    const stats = await syncMenuServiceDayItemsAfterMenuDayPublish(admin, {
      serviceDate: "2026-05-18",
      locationIds: ["loc1"],
      providerId: PROVIDER_A,
    });

    expect(mockFetchLunchCategoryRowsForProvider).toHaveBeenCalledWith(PROVIDER_A);
    expect(stats.msdiRowsUpserted).toBe(3);
    expect(stats.msdiLocationsSkippedNoTier).toBe(0);

    expect(varmrettCalls).toHaveLength(1);
    expect(String(varmrettCalls[0].query)).toContain("provider._ref == $providerRef");
    expect((varmrettCalls[0].params as Record<string, unknown>).providerRef).toBe(PROVIDER_A);

    const upserts = admin.getUpserts();
    expect(upserts).toHaveLength(1);
    const rows = upserts[0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.offered_price_cents_ex_vat).toBe(9000);
      expect(row.vat_rate_snapshot).toBe(0.15);
      expect(row.unit_name_snapshot).toBe("porsjon");
      expect(row.menu_service_day_id).toBe("msd1");
    }
    const paasmurt = rows.find((r) => r.product_id === "pr1");
    expect(String(paasmurt?.product_name_snapshot)).toContain("Påsmurt");
    expect(String(paasmurt?.product_name_snapshot)).toContain("Ost & Skinke");
    const varmrett = rows.find((r) => r.product_id === "pr3");
    expect(String(varmrett?.product_name_snapshot)).toContain("Laks");
    expect(String(varmrett?.product_name_snapshot)).toContain("Allergener:");
  });

  it("er idempotent ved gjentatt kjøring (samme antall rader i upsert)", async () => {
    mockFetchLunchCategoryRowsForProvider.mockResolvedValue(basisLunchRows());
    (sanityServer.fetch as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(
      async (q: string) => {
        if (q.includes("menuDay")) {
          return { mealTitle: null, meal: null };
        }
        return null;
      },
    );

    const admin = makeAdmin(seed);
    await syncMenuServiceDayItemsAfterMenuDayPublish(admin, {
      serviceDate: "2026-05-18",
      locationIds: ["loc1"],
      providerId: PROVIDER_A,
    });
    await syncMenuServiceDayItemsAfterMenuDayPublish(admin, {
      serviceDate: "2026-05-18",
      locationIds: ["loc1"],
      providerId: PROVIDER_A,
    });

    const upserts = admin.getUpserts();
    expect(upserts).toHaveLength(2);
    expect((upserts[0] as unknown[]).length).toBe((upserts[1] as unknown[]).length);
  });

  it("hopper lokasjon uten agreement_delivery_days-tier (fail-closed)", async () => {
    mockFetchLunchCategoryRowsForProvider.mockResolvedValue(
      basisLunchRows().filter((r) => r.key === "paasmurt"),
    );
    (sanityServer.fetch as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(
      async (q: string) => {
        if (q.includes("menuDay")) return {};
        return null;
      },
    );

    const upserts: unknown[] = [];
    const slimSeed: Seed = {
      locations: seed.locations,
      msds: seed.msds,
      categories: [{ id: "pc1", name: "Paasmurt" }],
      products: [{ id: "pr1", sku: "paasmurt", category_id: "pc1" }],
      agreementId: seed.agreementId,
      dayTier: "BASIS",
    };

    function agreementDeliveryDaysChain() {
      const chain = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error: null });
        },
      };
      return chain;
    }

    const captured = {
      from(table: string) {
        if (table === "agreement_delivery_days") {
          return agreementDeliveryDaysChain();
        }
        return createChain(table, slimSeed, upserts);
      },
    } as unknown as SupabaseClient<any>;

    const stats = await syncMenuServiceDayItemsAfterMenuDayPublish(captured, {
      serviceDate: "2026-05-18",
      locationIds: ["loc1"],
      providerId: PROVIDER_A,
    });

    expect(stats.msdiLocationsSkippedNoTier).toBe(1);
    expect(stats.msdiRowsUpserted).toBe(0);
    expect(upserts).toHaveLength(0);
  });

  it("fail-closed: uten provider-scope skrives ingen MSDI-rader", async () => {
    const admin = makeAdmin(seed);
    const stats = await syncMenuServiceDayItemsAfterMenuDayPublish(admin, {
      serviceDate: "2026-05-18",
      locationIds: ["loc1"],
      providerId: "",
    });

    expect(stats.msdiRowsUpserted).toBe(0);
    expect(stats.msdiLocationsSkippedNoTier).toBe(0);
    expect(admin.getUpserts()).toHaveLength(0);
    expect(mockFetchLunchCategoryRowsForProvider).not.toHaveBeenCalled();
    expect(sanityServer.fetch).not.toHaveBeenCalled();
  });

  it("bruker PLAN_CATEGORIES-fallback når Sanity lunchCategory er tom", async () => {
    mockFetchLunchCategoryRowsForProvider.mockResolvedValue([]);
    (sanityServer.fetch as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(
      async (q: string) => {
        if (q.includes("menuDay")) return { mealTitle: "Testrett første ordre", meal: null };
        return null;
      },
    );

    const admin = makeAdmin(seed);
    const stats = await syncMenuServiceDayItemsAfterMenuDayPublish(admin, {
      serviceDate: "2026-05-18",
      locationIds: ["loc1"],
      providerId: PROVIDER_A,
    });

    expect(stats.msdiRowsUpserted).toBe(3);
    const rows = admin.getUpserts()[0] as Array<Record<string, unknown>>;
    const varmrett = rows.find((r) => r.product_id === "pr3");
    expect(String(varmrett?.product_name_snapshot)).toContain("Testrett første ordre");
  });

  it("hopper lokasjon når companies.provider_id ikke matcher menuDay-provider", async () => {
    mockFetchLunchCategoryRowsForProvider.mockResolvedValue(
      basisLunchRows().filter((r) => r.key === "varmrett"),
    );
    (sanityServer.fetch as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(
      async (q: string) => {
        if (q.includes("menuDay")) return { mealTitle: "X", meal: null };
        return null;
      },
    );

    const wrongProviderSeed: Seed = { ...seed, companyProviderId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" };
    const admin = makeAdmin(wrongProviderSeed);
    const stats = await syncMenuServiceDayItemsAfterMenuDayPublish(admin, {
      serviceDate: "2026-05-18",
      locationIds: ["loc1"],
      providerId: PROVIDER_A,
    });

    expect(stats.msdiRowsUpserted).toBe(0);
    expect(admin.getUpserts()).toHaveLength(0);
  });

  it("bruker localized SOT MSDI mapping når flagg er ON (DKK, ikke legacy 9000)", async () => {
    vi.stubEnv("LP_LOCALIZED_GENERATOR_SOT_ENABLED", "true");
    vi.stubEnv("LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST", DANISH_PILOT);
    vi.stubEnv("LP_LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_MAPPING_ENABLED", "true");

    mockFetchLunchCategoryRowsForProvider.mockResolvedValue(
      basisLunchRows([{ title: "Ost & Skinke", description: "Klassiker", allergens: ["melk"] }]),
    );
    (sanityServer.fetch as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(
      async (q: string) => {
        if (q.includes("menuDay")) {
          return {
            mealTitle: "Kylling i karry",
            meal: { title: "Kylling", description: "Med ris", allergens: ["soya"] },
          };
        }
        return null;
      },
    );

    const admin = makeAdmin({ ...seed, companyProviderId: DANISH_PILOT });
    const stats = await syncMenuServiceDayItemsAfterMenuDayPublish(admin, {
      serviceDate: "2026-05-18",
      locationIds: ["loc1"],
      providerId: DANISH_PILOT,
    });

    expect(stats.msdiRowsUpserted).toBe(3);
    const rows = admin.getUpserts()[0] as Array<Record<string, unknown>>;
    for (const row of rows) {
      expect(row.offered_price_cents_ex_vat).not.toBe(9000);
      expect(row.vat_rate_snapshot).toBe(0.25);
      expect(row.snapshot_mode).toBe(LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE);
    }
    const varmrett = rows.find((r) => r.product_id === "pr3");
    expect(String(varmrett?.product_name_snapshot)).toContain("Kylling i karry");
  });

  it("forblir legacy tier-product når SOT MSDI mapping flagg er OFF", async () => {
    mockFetchLunchCategoryRowsForProvider.mockResolvedValue(basisLunchRows());
    (sanityServer.fetch as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(
      async (q: string) => {
        if (q.includes("menuDay")) {
          return { mealTitle: "Dagens varmrett", meal: null };
        }
        return null;
      },
    );

    const admin = makeAdmin(seed);
    await syncMenuServiceDayItemsAfterMenuDayPublish(admin, {
      serviceDate: "2026-05-18",
      locationIds: ["loc1"],
      providerId: PROVIDER_A,
    });

    const rows = admin.getUpserts()[0] as Array<Record<string, unknown>>;
    for (const row of rows) {
      expect(row.offered_price_cents_ex_vat).toBe(9000);
      expect(row.vat_rate_snapshot).toBe(0.15);
      expect(row.snapshot_mode ?? null).toBeNull();
    }
  });
});
