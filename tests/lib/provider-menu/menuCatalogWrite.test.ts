import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  buildProviderLunchCategoryDoc,
  validateMenuCatalogWriteInput,
  MenuCatalogWriteError,
} from "@/lib/provider-menu/menuCatalogWrite";

const PROVIDER_A = "11111111-1111-1111-1111-111111111111";
const PROVIDER_B = "22222222-2222-2222-2222-222222222222";

const templateRows = [
  {
    key: "paasmurt",
    title: "Påsmurt",
    displayOrder: 1,
    allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
    items: [
      { key: "ost-skinke", title: "Ost & Skinke", allergens: ["melk"], isVegetarian: false },
      { key: "laks-eggerore", title: "Laks & Eggerøre", allergens: ["fisk"], isVegetarian: false },
    ],
  },
];

vi.mock("@/lib/cms/lunchCategory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cms/lunchCategory")>();
  return {
    ...actual,
    fetchLunchCategoryTemplateRows: vi.fn(async () => templateRows),
    fetchLunchCategoryRowsForProvider: vi.fn(async (providerId: string) => {
      if (providerId === PROVIDER_A) {
        return [
          {
            key: "paasmurt",
            title: "Påsmurt",
            allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
            items: [{ key: "custom-a", title: "A spesial", allergens: [], isVegetarian: true }],
          },
        ];
      }
      return templateRows;
    }),
  };
});

vi.mock("@/lib/sanity/server", () => ({
  sanityServer: {
    fetch: vi.fn(async (query: string, params?: { id?: string }) => {
      const id = params?.id ?? "";
      if (id === `lunchCategory-${PROVIDER_A}-paasmurt`) {
        return {
          key: "paasmurt",
          title: "Påsmurt",
          allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
          items: [{ key: "custom-a", title: "A spesial", allergens: [], isVegetarian: true }],
        };
      }
      return null;
    }),
  },
}));

describe("menuCatalogWrite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects varmrett category", () => {
    const err = validateMenuCatalogWriteInput({
      categoryKey: "varmrett",
      items: [{ title: "X" }],
    });
    expect(err?.message).toContain("Kategori");
  });

  it("copy-on-write uses template title and tiers", async () => {
    const { doc } = await buildProviderLunchCategoryDoc(PROVIDER_B, {
      categoryKey: "paasmurt",
      items: [
        { key: "ost-skinke", title: "Ost & Skinke oppdatert", allergens: ["melk"] },
      ],
    });
    expect(doc._id).toBe(`lunchCategory-${PROVIDER_B}-paasmurt`);
    expect(doc.title).toBe("Påsmurt");
    expect((doc.items as { slug: { current: string }; title: string }[])[0]?.title).toBe(
      "Ost & Skinke oppdatert",
    );
    expect((doc.items as { slug: { current: string } }[])[0]?.slug.current).toBe("ost-skinke");
    expect((doc.items as { allowedPlanTiers: string[] }[])[0]?.allowedPlanTiers).toEqual([
      "BASIS",
      "LUXUS",
      "ENTERPRISE",
    ]);
  });

  it("generates slug for new items", async () => {
    const { doc } = await buildProviderLunchCategoryDoc(PROVIDER_B, {
      categoryKey: "paasmurt",
      items: [
        { key: "ost-skinke", title: "Ost & Skinke", allergens: [] },
        { title: "Ny rett", allergens: [], isVegetarian: true },
      ],
    });
    const items = doc.items as { slug: { current: string }; title: string }[];
    expect(items.length).toBe(2);
    expect(items[1]?.slug.current).toBe("ny-rett");
    expect(items[1]?.title).toBe("Ny rett");
  });

  it("rejects unknown existing key", async () => {
    await expect(
      buildProviderLunchCategoryDoc(PROVIDER_B, {
        categoryKey: "paasmurt",
        items: [{ key: "stolen-slug", title: "Hack" }],
      }),
    ).rejects.toThrow(MenuCatalogWriteError);
  });

  it("provider A doc id differs from B", async () => {
    const a = await buildProviderLunchCategoryDoc(PROVIDER_A, {
      categoryKey: "paasmurt",
      items: [{ key: "custom-a", title: "A spesial" }],
    });
    const b = await buildProviderLunchCategoryDoc(PROVIDER_B, {
      categoryKey: "paasmurt",
      items: [{ key: "ost-skinke", title: "Ost & Skinke" }],
    });
    expect(a.doc._id).not.toBe(b.doc._id);
    expect(a.doc._id).toBe(`lunchCategory-${PROVIDER_A}-paasmurt`);
  });
});
