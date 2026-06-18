import { describe, expect, it } from "vitest";

import { canonicalVariantTitle } from "@/lib/provider-menu/menuVariantCanonical";
import {
  BASIS_WORKSPACE_CATEGORIES,
  ENTERPRISE_TIER_MODEL,
  ENTERPRISE_WORKSPACE_CATEGORIES,
  fixedVariantsForCategory,
  isSanityDrivenCategory,
  LUXUS_WORKSPACE_CATEGORIES,
  MENU_TIER_CONTRACT_SOURCE,
  PROVIDER_MENU_CATEGORY_CONTRACTS,
  tierIncludesCategory,
  workspaceCategoriesForTier,
} from "@/lib/provider-menu/providerMenuTierContract";
import {
  providerWorkspaceCategories,
  resolveVariantRowsForDay,
} from "@/lib/provider-menu/providerMenuCatalogSurface";
import type { ResolvedProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";
import { validateEnterprisePublish } from "@/lib/providers/providerMenuPackageSurface";

describe("providerMenuTierContract", () => {
  it("documents authoritative source file", () => {
    expect(MENU_TIER_CONTRACT_SOURCE).toBe("scripts/sanity/seed-lunch-categories-v2.ts");
  });

  it("Basis categories = Påsmurt, Salatboks, Varmrett", () => {
    expect(providerWorkspaceCategories("BASIS")).toEqual(["paasmurt", "salat", "varmrett"]);
    expect(BASIS_WORKSPACE_CATEGORIES).toHaveLength(3);
  });

  it("Basis does not include Sushi, Pokébowl, Thai", () => {
    const basis = providerWorkspaceCategories("BASIS");
    expect(basis).not.toContain("sushi");
    expect(basis).not.toContain("pokebowl");
    expect(basis).not.toContain("thai");
    expect(tierIncludesCategory("BASIS", "sushi")).toBe(false);
  });

  it("Basis Påsmurt variants include Ost & Skinke, Laks & Eggerøre, Kyllingkarri, Vegetar", () => {
    expect(fixedVariantsForCategory("paasmurt").map((v) => v.title)).toEqual([
      "Ost & Skinke",
      "Laks & Eggerøre",
      "Kyllingkarri",
      "Vegetar",
    ]);
  });

  it("Basis Salatboks variants include Skinke, Kylling, Vegetar", () => {
    expect(fixedVariantsForCategory("salat").map((v) => v.title)).toEqual(["Skinke", "Kylling", "Vegetar"]);
  });

  it("Basis Varmrett is Sanity/bank driven", () => {
    expect(isSanityDrivenCategory("varmrett")).toBe(true);
    expect(fixedVariantsForCategory("varmrett")).toHaveLength(0);
    const rows = resolveVariantRowsForDay({}, "2026-06-16", "BASIS", "varmrett");
    expect(rows[0]?.status).toBe("Mangler varmmat fra Sanity/bank");
  });

  it("Luxus includes all six categories", () => {
    expect(providerWorkspaceCategories("LUXUS")).toEqual([
      "paasmurt",
      "salat",
      "sushi",
      "pokebowl",
      "thai",
      "varmrett",
    ]);
    expect(LUXUS_WORKSPACE_CATEGORIES).toHaveLength(6);
  });

  it("Luxus Sushi is fixed package", () => {
    expect(fixedVariantsForCategory("sushi").map((v) => v.title)).toEqual([
      "Fast pakke: 6 maki + 2 nigiri + 1 tempura",
    ]);
  });

  it("Luxus Pokébowl includes Laks, Kylling, Vegetar", () => {
    expect(fixedVariantsForCategory("pokebowl").map((v) => v.title)).toEqual(["Laks", "Kylling", "Vegetar"]);
  });

  it("Luxus Thai includes Pad Thai nudler, Biff peppersaus wok, Pad med mamuang wok", () => {
    expect(fixedVariantsForCategory("thai").map((v) => v.title)).toEqual([
      "Pad Thai nudler",
      "Biff peppersaus wok",
      "Pad med mamuang wok",
    ]);
  });

  it("Enterprise includes all six categories", () => {
    expect(providerWorkspaceCategories("ENTERPRISE")).toHaveLength(6);
    expect(ENTERPRISE_WORKSPACE_CATEGORIES).toEqual(LUXUS_WORKSPACE_CATEGORIES);
  });

  it("Enterprise requires or warns for upgrade value", () => {
    const blocking = validateEnterprisePublish({
      tier: "ENTERPRISE",
      mealTitle: "Pokébowl Laks",
      description: "",
      sourcePackage: "LUXUS",
      upgradeType: null,
      upgradeNote: "",
      estimatedCostPerPortion: null,
      luxusEstimatedCost: null,
      priceExVatNok: 170,
    });
    expect(blocking.some((w) => w.code === "UPGRADE_REQUIRED" && w.blocking)).toBe(true);

    const weak = validateEnterprisePublish({
      tier: "ENTERPRISE",
      mealTitle: "Egen rett",
      description: "",
      sourcePackage: null,
      upgradeType: null,
      upgradeNote: "",
      estimatedCostPerPortion: null,
      luxusEstimatedCost: null,
      priceExVatNok: 170,
    });
    expect(weak.some((w) => w.code === "WEAK_VALUE" && !w.blocking)).toBe(true);
  });

  it("Enterprise can derive from Luxus without overwriting Luxus", () => {
    const slots: Record<string, ResolvedProviderMenuSlot> = {
      "2026-06-16:LUXUS:pokebowl": {
        date: "2026-06-16",
        tier: "LUXUS",
        category: "pokebowl",
        mealTitle: "Pokébowl",
        description: "Luxus",
        allergensText: "",
        estimatedCostPerPortion: 55,
        sourcePackage: null,
        upgradeType: null,
        upgradeNote: "",
        status: "published",
        contentSource: "published",
      },
      "2026-06-16:ENTERPRISE:pokebowl": {
        date: "2026-06-16",
        tier: "ENTERPRISE",
        category: "pokebowl",
        mealTitle: "Pokébowl premium",
        description: "Ekstra laks",
        allergensText: "",
        estimatedCostPerPortion: 62,
        sourcePackage: "LUXUS",
        upgradeType: "PREMIUM_PROTEIN",
        upgradeNote: "Ekstra laks og ponzu",
        status: "draft",
        contentSource: "draft",
      },
    };
    const luxusRows = resolveVariantRowsForDay(slots, "2026-06-16", "LUXUS", "pokebowl");
    const enterpriseRows = resolveVariantRowsForDay(slots, "2026-06-16", "ENTERPRISE", "pokebowl");
    expect(luxusRows.every((r) => r.status === "Publisert")).toBe(true);
    expect(enterpriseRows[0]?.enterpriseSourceLabel).toBe("Basert på Luxus");
    expect(enterpriseRows[0]?.enterpriseUpgradeLabel).toBe("Premium protein");
  });

  it("published menuDay overrides contract placeholder", () => {
    const slots: Record<string, ResolvedProviderMenuSlot> = {
      "2026-06-16:BASIS:paasmurt": {
        date: "2026-06-16",
        tier: "BASIS",
        category: "paasmurt",
        mealTitle: "Påsmurt",
        description: "",
        allergensText: "",
        estimatedCostPerPortion: null,
        sourcePackage: null,
        upgradeType: null,
        upgradeNote: "",
        status: "published",
        contentSource: "published",
      },
    };
    const rows = resolveVariantRowsForDay(slots, "2026-06-16", "BASIS", "paasmurt");
    expect(rows.every((r) => r.status === "Publisert")).toBe(true);
  });

  it("fixed variants render as Fast valg when no menuDay override", () => {
    const rows = resolveVariantRowsForDay({}, "2026-06-16", "BASIS", "paasmurt");
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.status === "Fast valg")).toBe(true);
  });

  it("package switch keeps tier-specific categories", () => {
    expect(workspaceCategoriesForTier("BASIS")).toHaveLength(3);
    expect(workspaceCategoriesForTier("LUXUS")).toHaveLength(6);
    expect(workspaceCategoriesForTier("ENTERPRISE")).toHaveLength(6);
  });

  it("Enterprise tier model defines premium price", () => {
    expect(ENTERPRISE_TIER_MODEL.priceExVatNok).toBe(170);
    expect(ENTERPRISE_TIER_MODEL.priceIncVatNok).toBe(195.5);
    expect(ENTERPRISE_TIER_MODEL.requiresUpgrade).toBe(true);
  });

  it("catalog has six category contracts", () => {
    expect(PROVIDER_MENU_CATEGORY_CONTRACTS).toHaveLength(6);
  });
});

describe("menuVariantCanonical", () => {
  it("normalizes legacy variant aliases", () => {
    expect(canonicalVariantTitle("Ost & skinke")).toBe("Ost & Skinke");
    expect(canonicalVariantTitle("Kylling karri")).toBe("Kyllingkarri");
    expect(canonicalVariantTitle("Pad Thai")).toBe("Pad Thai nudler");
    expect(canonicalVariantTitle("Biff peppersaus")).toBe("Biff peppersaus wok");
    expect(canonicalVariantTitle("Pad med mamuang")).toBe("Pad med mamuang wok");
  });
});
