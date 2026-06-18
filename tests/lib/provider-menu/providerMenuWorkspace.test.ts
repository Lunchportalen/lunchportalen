import { describe, expect, it } from "vitest";

import {
  CATALOG_PERSISTENCE_GAP,
  EMPLOYEE_WEEK_IMAGE_GAP,
  buildMenuCatalogVariants,
  catalogSupportsPersistentEdit,
  catalogVariantsForTier,
} from "@/lib/provider-menu/providerMenuCatalogReadModel";
import {
  buildEditorContext,
  editorContextLine,
  summarizeCategoryDay,
} from "@/lib/provider-menu/providerMenuWorkspace";
import { providerWorkspaceCategories } from "@/lib/provider-menu/providerMenuCatalogSurface";
import type { ResolvedProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";

describe("providerMenuCatalogReadModel", () => {
  it("builds catalog from fixed contract", () => {
    const catalog = buildMenuCatalogVariants();
    expect(catalog.length).toBeGreaterThan(10);
    expect(catalog.some((v) => v.label === "Ost & Skinke")).toBe(true);
    expect(catalog.some((v) => v.source === "SANITY")).toBe(true);
  });

  it("Basis catalog excludes Luxus-only categories", () => {
    const basis = catalogVariantsForTier("BASIS");
    expect(basis.some((v) => v.category === "sushi")).toBe(false);
    expect(basis.some((v) => v.category === "paasmurt")).toBe(true);
  });

  it("reports missing persistent catalog storage", () => {
    expect(catalogSupportsPersistentEdit()).toBe(false);
    expect(CATALOG_PERSISTENCE_GAP).toContain("lagringsmodell");
    expect(EMPLOYEE_WEEK_IMAGE_GAP).toContain("/week");
  });

  it("allergens render for fixed variants from seed mirror", () => {
    const paasmurt = buildMenuCatalogVariants().find((v) => v.id === "paasmurt:ost-skinke");
    expect(paasmurt?.allergens).toContain("melk");
  });

  it("image slot is null without fake storage", () => {
    expect(buildMenuCatalogVariants().every((v) => v.imageUrl === null)).toBe(true);
  });
});

describe("providerMenuWorkspace", () => {
  it("Basis workspace categories unchanged", () => {
    expect(providerWorkspaceCategories("BASIS")).toEqual(["paasmurt", "salat", "varmrett"]);
  });

  it("Luxus workspace has six categories", () => {
    expect(providerWorkspaceCategories("LUXUS")).toHaveLength(6);
  });

  it("editor context shows package/day/category/variant", () => {
    const ctx = buildEditorContext({
      tier: "LUXUS",
      tierLabel: "Luxus",
      weekdayLabel: "Tirsdag",
      date: "2026-06-16",
      category: "varmrett",
      variantLabel: null,
    });
    expect(editorContextLine(ctx)).toBe("Luxus · Tirsdag · Varmrett");
    expect(ctx.mode).toBe("varmrett");
  });

  it("Enterprise editor context uses enterprise mode", () => {
    const ctx = buildEditorContext({
      tier: "ENTERPRISE",
      tierLabel: "Enterprise",
      weekdayLabel: "Mandag",
      date: "2026-06-15",
      category: "pokebowl",
      variantLabel: "Laks",
    });
    expect(ctx.mode).toBe("enterprise");
    expect(editorContextLine(ctx)).toContain("Laks");
  });

  it("varmrett summary shows missing when empty", () => {
    const summary = summarizeCategoryDay({}, "2026-06-16", "BASIS", "varmrett");
    expect(summary.statusChip).toBe("missing");
    expect(summary.isSanityDriven).toBe(true);
  });

  it("published slot does not get blanked in summary", () => {
    const slots: Record<string, ResolvedProviderMenuSlot> = {
      "2026-06-16:BASIS:varmrett": {
        date: "2026-06-16",
        tier: "BASIS",
        category: "varmrett",
        mealTitle: "Kjøttkaker",
        description: "Med potet",
        allergensText: "melk",
        estimatedCostPerPortion: 42,
        sourcePackage: null,
        upgradeType: null,
        upgradeNote: "",
        status: "published",
        contentSource: "published",
      },
    };
    const summary = summarizeCategoryDay(slots, "2026-06-16", "BASIS", "varmrett");
    expect(summary.statusChip).toBe("published");
    expect(summary.rows[0]?.title).toBe("Kjøttkaker");
  });
});
