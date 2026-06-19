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
  summarizeWeekMetrics,
  summarizeDayCard,
  summarizeSharedVarmrettDay,
  resolveSharedVarmrettSlot,
  PACKAGE_CARD_COPY,
  SHARED_WARM_DISH_HINT,
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

  it("varmrett editor context is tier-agnostic", () => {
    const ctx = buildEditorContext({
      tier: "LUXUS",
      tierLabel: "Luxus",
      weekdayLabel: "Tirsdag",
      date: "2026-06-16",
      category: "varmrett",
      variantLabel: null,
      editorFocus: "varmrett",
    });
    expect(editorContextLine(ctx)).toBe("Tirsdag · felles for alle pakker");
    expect(ctx.mode).toBe("varmrett");
  });

  it("enterprise upgrade editor context is add-on framing", () => {
    const ctx = buildEditorContext({
      tier: "ENTERPRISE",
      tierLabel: "Enterprise",
      weekdayLabel: "Mandag",
      date: "2026-06-15",
      category: "varmrett",
      variantLabel: null,
      editorFocus: "enterprise-upgrade",
    });
    expect(ctx.mode).toBe("enterprise");
    expect(editorContextLine(ctx)).toBe("Mandag · tillegg til dagens varmmrett");
  });

  it("category editor context keeps tier label", () => {
    const ctx = buildEditorContext({
      tier: "ENTERPRISE",
      tierLabel: "Enterprise",
      weekdayLabel: "Mandag",
      date: "2026-06-15",
      category: "pokebowl",
      variantLabel: "Laks",
    });
    expect(ctx.mode).toBe("catalog");
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

  it("package card copy describes shared warm dish model", () => {
    expect(PACKAGE_CARD_COPY.BASIS.includes).toContain("Dagens varmmrett");
    expect(PACKAGE_CARD_COPY.LUXUS.includes).toContain("Basis + Sushi");
    expect(PACKAGE_CARD_COPY.ENTERPRISE.includes).toContain("Enterprise-upgrade");
  });

  it("resolveSharedVarmrettSlot prefers published content across tiers", () => {
    const slots: Record<string, ResolvedProviderMenuSlot> = {
      "2026-06-16:BASIS:varmrett": {
        date: "2026-06-16",
        tier: "BASIS",
        category: "varmrett",
        mealTitle: "Felles rett",
        description: "",
        allergensText: "",
        estimatedCostPerPortion: null,
        sourcePackage: null,
        upgradeType: null,
        upgradeNote: "",
        status: "published",
        contentSource: "published",
      },
      "2026-06-16:ENTERPRISE:varmrett": {
        date: "2026-06-16",
        tier: "ENTERPRISE",
        category: "varmrett",
        mealTitle: "Annen enterprise tittel",
        description: "",
        allergensText: "",
        estimatedCostPerPortion: null,
        sourcePackage: null,
        upgradeType: null,
        upgradeNote: "",
        status: "draft",
        contentSource: "draft",
      },
    };
    const shared = resolveSharedVarmrettSlot(slots, "2026-06-16");
    expect(shared.mealTitle).toBe("Felles rett");
  });

  it("summarizeSharedVarmrettDay is used in day card", () => {
    const categories = providerWorkspaceCategories("LUXUS");
    const card = summarizeDayCard({}, "2026-06-15", "LUXUS", "Mandag", categories);
    expect(card.varmrett.isSanityDriven).toBe(true);
    expect(SHARED_WARM_DISH_HINT).toBe("Samme for alle pakker");
    const shared = summarizeSharedVarmrettDay({}, "2026-06-15");
    expect(shared.statusChip).toBe("missing");
  });

  it("summarizeWeekMetrics counts varmrett missing from read-model", () => {
    const dates = ["2026-06-15", "2026-06-16"];
    const categories = providerWorkspaceCategories("BASIS");
    const metrics = summarizeWeekMetrics({}, dates, "BASIS", categories);
    expect(metrics.daysPlanned).toBe(2);
    expect(metrics.varmrettMissing).toBe(2);
    expect(metrics.varmrettFilled).toBe(0);
  });

  it("summarizeDayCard groups fixed categories compactly", () => {
    const dates = ["2026-06-15"];
    const categories = providerWorkspaceCategories("BASIS");
    const card = summarizeDayCard({}, "2026-06-15", "BASIS", "Mandag", categories);
    expect(card.varmrett.isSanityDriven).toBe(true);
    expect(card.fixedGroups.length).toBe(2);
    expect(card.fixedGroups.every((g) => g.variantCount > 0)).toBe(true);
    expect(card.premiumGroups.length).toBe(0);
  });
});
