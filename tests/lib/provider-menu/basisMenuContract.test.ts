import { describe, expect, it } from "vitest";

import {
  BASIS_MENU_CONTRACT_SOURCE,
  fixedVariantsForCategory,
  isSanityDrivenCategory,
  PROVIDER_BASIS_WORKSPACE_CATEGORIES,
  PROVIDER_MENU_CATEGORY_CONTRACTS,
  workspaceCategoriesForTier,
} from "@/lib/provider-menu/basisMenuContract";
import {
  providerWorkspaceCategories,
  resolveVariantRowsForDay,
} from "@/lib/provider-menu/providerMenuCatalogSurface";
import type { ResolvedProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";

describe("basisMenuContract forensic restore", () => {
  it("documents authoritative source file", () => {
    expect(BASIS_MENU_CONTRACT_SOURCE).toBe("scripts/sanity/seed-lunch-categories-v2.ts");
  });

  it("Basis Påsmurt includes Ost & skinke", () => {
    expect(fixedVariantsForCategory("paasmurt").map((v) => v.title)).toContain("Ost & skinke");
  });

  it("Basis Påsmurt includes Kylling karri", () => {
    expect(fixedVariantsForCategory("paasmurt").map((v) => v.title)).toContain("Kylling karri");
  });

  it("Basis Påsmurt includes Vegetar", () => {
    expect(fixedVariantsForCategory("paasmurt").map((v) => v.title)).toContain("Vegetar");
  });

  it("Basis Salatboks includes Skinke", () => {
    expect(fixedVariantsForCategory("salat").map((v) => v.title)).toContain("Skinke");
  });

  it("Basis Salatboks includes Kylling", () => {
    expect(fixedVariantsForCategory("salat").map((v) => v.title)).toContain("Kylling");
  });

  it("Basis Salatboks includes Vegetar", () => {
    expect(fixedVariantsForCategory("salat").map((v) => v.title)).toContain("Vegetar");
  });

  it("Basis Pokebowl includes Laks", () => {
    expect(fixedVariantsForCategory("pokebowl").map((v) => v.title)).toContain("Laks");
  });

  it("Basis Pokebowl includes Kylling", () => {
    expect(fixedVariantsForCategory("pokebowl").map((v) => v.title)).toContain("Kylling");
  });

  it("Basis Pokebowl includes Vegetar", () => {
    expect(fixedVariantsForCategory("pokebowl").map((v) => v.title)).toContain("Vegetar");
  });

  it("Basis Sushi includes Fast meny", () => {
    expect(fixedVariantsForCategory("sushi").map((v) => v.title)).toContain("Fast meny");
  });

  it("Basis Thai includes Pad Thai", () => {
    expect(fixedVariantsForCategory("thai").map((v) => v.title)).toContain("Pad Thai");
  });

  it("Basis Thai includes Pad med mamuang", () => {
    expect(fixedVariantsForCategory("thai").map((v) => v.title)).toContain("Pad med mamuang");
  });

  it("Basis Thai includes Biff peppersaus", () => {
    expect(fixedVariantsForCategory("thai").map((v) => v.title)).toContain("Biff peppersaus");
  });

  it("Basis Varmmat is Sanity-driven", () => {
    expect(isSanityDrivenCategory("varmrett")).toBe(true);
    expect(fixedVariantsForCategory("varmrett")).toHaveLength(0);
  });

  it("provider Basis workspace shows all six categories", () => {
    expect(PROVIDER_BASIS_WORKSPACE_CATEGORIES).toEqual([
      "paasmurt",
      "salat",
      "sushi",
      "pokebowl",
      "thai",
      "varmrett",
    ]);
    expect(providerWorkspaceCategories("BASIS")).toHaveLength(6);
  });

  it("does not reduce Basis workspace to only Påsmurt/Salat/Varmrett", () => {
    const basis = providerWorkspaceCategories("BASIS");
    expect(basis).toContain("sushi");
    expect(basis).toContain("pokebowl");
    expect(basis).toContain("thai");
    expect(basis.length).toBeGreaterThan(3);
  });

  it("fixed variants render as Fast valg when no menuDay override", () => {
    const rows = resolveVariantRowsForDay({}, "2026-06-16", "BASIS", "paasmurt");
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.status === "Fast valg")).toBe(true);
    expect(rows.map((r) => r.title)).toEqual(["Ost & skinke", "Kylling karri", "Vegetar"]);
  });

  it("varmrett without menuDay shows Mangler varmmat fra Sanity", () => {
    const rows = resolveVariantRowsForDay({}, "2026-06-16", "BASIS", "varmrett");
    expect(rows[0]?.status).toBe("Mangler varmmat fra Sanity");
    expect(rows[0]?.editable).toBe(true);
  });

  it("catalog has six category contracts", () => {
    expect(PROVIDER_MENU_CATEGORY_CONTRACTS).toHaveLength(6);
  });

  it("Luxus workspace includes seed-allowed categories", () => {
    const luxus = workspaceCategoriesForTier("LUXUS");
    expect(luxus).toContain("paasmurt");
    expect(luxus).toContain("sushi");
    expect(luxus).toContain("varmrett");
  });

  it("published menuDay overrides fixed placeholder status", () => {
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
    expect(rows.map((r) => r.title)).toEqual(["Ost & skinke", "Kylling karri", "Vegetar"]);
  });

  it("package switch keeps Basis workspace categories intact", () => {
    const basis = providerWorkspaceCategories("BASIS");
    const luxus = providerWorkspaceCategories("LUXUS");
    const enterprise = providerWorkspaceCategories("ENTERPRISE");
    expect(basis).toHaveLength(6);
    expect(luxus.length).toBeGreaterThanOrEqual(3);
    expect(enterprise.length).toBeGreaterThanOrEqual(3);
    expect(basis).toEqual(PROVIDER_BASIS_WORKSPACE_CATEGORIES);
  });

  it("Enterprise tier does not overwrite Basis fixed catalog", () => {
    const enterprisePaasmurt = fixedVariantsForCategory("paasmurt");
    const basisRows = resolveVariantRowsForDay({}, "2026-06-16", "BASIS", "paasmurt");
    const enterpriseRows = resolveVariantRowsForDay({}, "2026-06-16", "ENTERPRISE", "paasmurt");
    expect(enterpriseRows.map((r) => r.title)).toEqual(basisRows.map((r) => r.title));
    expect(enterprisePaasmurt).toHaveLength(3);
  });
});
