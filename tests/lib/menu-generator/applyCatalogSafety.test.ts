import { describe, expect, it } from "vitest";

import {
  buildCatalogUpdateConfirmationToken,
  catalogDiffWouldUpdateExisting,
  CATALOG_REPLACE_CONFIRMATION_PHRASE,
  enforceCatalogUpdatePolicy,
  isStrictCatalogOverwriteMode,
  verifyCatalogUpdateConfirmationToken,
} from "@/lib/menu-generator/applyCatalogSafety";
import { buildFullApplyDiff } from "@/lib/menu-generator/fullApplyDiff";
import { buildFullLocalizedWeekMenuDraft } from "@/lib/menu-generator/fullApplyDomain";
import { resolveEconomyConfigForCountry } from "@/lib/menu-generator/countryEconomyDefaults";
import { FIXED_CATEGORY_KEYS } from "@/lib/menu-generator/types";
import type { ProviderMenuCatalogSnapshot } from "@/lib/provider-menu/lunchCategoryCatalog";
import type { ProviderOrderLockState } from "@/lib/provider-menu/providerMenuOrderLock";

const PROVIDER = "11111111-1111-1111-1111-111111111111";
const WEEK = "2031-03-31";
const EMPTY_LOCK: ProviderOrderLockState = {
  datesWithOrders: new Set(),
  lockedCatalogItemKeys: new Set(),
  orderCountsByDate: new Map(),
  queryFailed: false,
};

function melhusLikeCatalog(): ProviderMenuCatalogSnapshot {
  return {
    rows: [
      {
        key: "paasmurt",
        title: "Påsmurt",
        items: [
          { key: "ost-skinke", title: "Ost & Skinke", allergens: ["hvete", "melk"] },
          { key: "laks-eggerore", title: "Laks & Eggerøre", allergens: ["hvete", "egg", "fisk"] },
        ],
      },
      {
        key: "salatboks",
        title: "Salatboks",
        items: [{ key: "skinke", title: "Skinke", allergens: ["melk"] }],
      },
      {
        key: "sushi",
        title: "Sushi",
        items: [{ key: "sushi-pakke", title: "Sushi-pakke", allergens: ["fisk"] }],
      },
      {
        key: "pokebowl",
        title: "Pokebowl",
        items: [{ key: "laks", title: "Laks", allergens: ["fisk"] }],
      },
      {
        key: "thaimat",
        title: "Thaimat",
        items: [{ key: "pad-thai-nudler", title: "Pad Thai nudler", allergens: ["soya"] }],
      },
    ],
  };
}

function strictDiff(catalog: ProviderMenuCatalogSnapshot) {
  const draft = buildFullLocalizedWeekMenuDraft({
    providerId: PROVIDER,
    weekStart: WEEK,
    menuLocale: "nb-NO",
    country: "NO",
    menuProfileId: "norwegian_company_lunch",
    packageTier: "LUXUS",
    enabledCategories: FIXED_CATEGORY_KEYS,
    economyConfig: resolveEconomyConfigForCountry("NO"),
  });
  return buildFullApplyDiff({
    draft,
    existingRows: [],
    catalog,
    overwriteMode: "create_missing_only_strict",
    lockState: EMPTY_LOCK,
    categoryScope: "all_supported",
  });
}

describe("applyCatalogSafety", () => {
  it("builds and verifies catalog update confirmation token from idempotencyKey", () => {
    const key = "provider|2031-03-31|nb-NO|norwegian_company_lunch|all_supported|create_missing_only_strict|LUXUS|2.0.0";
    const token = buildCatalogUpdateConfirmationToken(key);
    expect(token).toHaveLength(32);
    expect(verifyCatalogUpdateConfirmationToken(key, token)).toBe(true);
    expect(verifyCatalogUpdateConfirmationToken(key, "wrong")).toBe(false);
  });

  it("requires exact replace confirmation phrase constant", () => {
    expect(CATALOG_REPLACE_CONFIRMATION_PHRASE).toContain("katalogvalg");
  });

  it("create_missing_only_strict skips existing catalog categories and creates vegetarian only", () => {
    const diff = strictDiff(melhusLikeCatalog());
    const sandwich = diff.catalogCategories.find((c) => c.categoryKey === "sandwich");
    const salad = diff.catalogCategories.find((c) => c.categoryKey === "salad");
    const sushi = diff.catalogCategories.find((c) => c.categoryKey === "sushi");
    const poke = diff.catalogCategories.find((c) => c.categoryKey === "poke");
    const asian = diff.catalogCategories.find((c) => c.categoryKey === "asian");
    const vegetarian = diff.catalogCategories.find((c) => c.categoryKey === "vegetarian");

    expect(sandwich?.status).toBe("would_skip_existing_category");
    expect(salad?.status).toBe("would_skip_existing_category");
    expect(sushi?.status).toBe("would_skip_existing_category");
    expect(poke?.status).toBe("would_skip_existing_category");
    expect(asian?.status).toBe("would_skip_existing_category");
    expect(vegetarian?.status).toBe("would_create_category");

    expect(diff.summary.updatedCategories).toBe(0);
    expect(diff.summary.skippedExistingCategories).toBeGreaterThanOrEqual(5);
    expect(diff.summary.createdDraftDays).toBe(5);
    expect(catalogDiffWouldUpdateExisting(diff.catalogCategories)).toBe(false);
  });

  it("legacy create_missing_only would update existing catalog when generated items differ", () => {
    const draft = buildFullLocalizedWeekMenuDraft({
      providerId: PROVIDER,
      weekStart: WEEK,
      menuLocale: "nb-NO",
      country: "NO",
      menuProfileId: "norwegian_company_lunch",
      packageTier: "LUXUS",
      enabledCategories: FIXED_CATEGORY_KEYS,
      economyConfig: resolveEconomyConfigForCountry("NO"),
    });
    const diff = buildFullApplyDiff({
      draft,
      existingRows: [],
      catalog: melhusLikeCatalog(),
      overwriteMode: "create_missing_only",
      lockState: EMPTY_LOCK,
      categoryScope: "all_supported",
    });
    expect(diff.catalogCategories.find((c) => c.categoryKey === "sandwich")?.status).toBe(
      "would_update_category",
    );
    expect(catalogDiffWouldUpdateExisting(diff.catalogCategories)).toBe(true);
  });

  it("create_future_menu_days_only skips all catalog categories including missing vegetarian", () => {
    const draft = buildFullLocalizedWeekMenuDraft({
      providerId: PROVIDER,
      weekStart: WEEK,
      menuLocale: "nb-NO",
      country: "NO",
      menuProfileId: "norwegian_company_lunch",
      packageTier: "LUXUS",
      enabledCategories: FIXED_CATEGORY_KEYS,
      economyConfig: resolveEconomyConfigForCountry("NO"),
    });
    const diff = buildFullApplyDiff({
      draft,
      existingRows: [],
      catalog: melhusLikeCatalog(),
      overwriteMode: "create_future_menu_days_only",
      lockState: EMPTY_LOCK,
      categoryScope: "all_supported",
    });
    expect(diff.catalogCategories.every((c) => c.status === "would_skip_existing_category")).toBe(true);
    expect(diff.catalogCategories.some((c) => c.status === "would_create_category")).toBe(false);
    expect(diff.summary.updatedCategories).toBe(0);
    expect(diff.summary.createdDraftDays).toBe(5);
  });

  it("isStrictCatalogOverwriteMode identifies strict mode", () => {
    expect(isStrictCatalogOverwriteMode("create_missing_only_strict")).toBe(true);
    expect(isStrictCatalogOverwriteMode("create_missing_only")).toBe(false);
  });

  it("enforceCatalogUpdatePolicy blocks strict mode catalog updates", () => {
    expect(
      enforceCatalogUpdatePolicy({
        overwriteMode: "create_missing_only_strict",
        idempotencyKey: "k",
        catalogWouldUpdate: true,
      })?.errorCode,
    ).toBe("catalog_update_requires_confirmation");
  });

  it("replace_catalog_with_confirmation requires phrase and token", () => {
    const idempotencyKey = "test-key";
    const token = buildCatalogUpdateConfirmationToken(idempotencyKey);
    expect(
      enforceCatalogUpdatePolicy({
        overwriteMode: "replace_catalog_with_confirmation",
        idempotencyKey,
        catalogWouldUpdate: true,
        replaceCatalogConfirmationPhrase: CATALOG_REPLACE_CONFIRMATION_PHRASE,
      })?.errorCode,
    ).toBe("catalog_update_requires_confirmation");

    expect(
      enforceCatalogUpdatePolicy({
        overwriteMode: "replace_catalog_with_confirmation",
        idempotencyKey,
        catalogWouldUpdate: true,
        catalogUpdateConfirmationToken: token,
        replaceCatalogConfirmationPhrase: CATALOG_REPLACE_CONFIRMATION_PHRASE,
      }),
    ).toBeNull();
  });
});
