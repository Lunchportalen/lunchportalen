import { describe, expect, it } from "vitest";

import { buildApplyIdempotencyKey, isSupportedApplyMenuLocale } from "@/lib/menu-generator/applyTypes";
import { formatAllergensForMenuDay } from "@/lib/menu-generator/allergenMenuDayFormat";
import {
  buildApplyWeekDiff,
  dryRunSummaryFromDays,
  wouldMutateInDryRun,
} from "@/lib/menu-generator/applyWeekMenuDiff";
import {
  enterpriseHotMealIdentityStable,
  mapGeneratedWeekToApplyTargets,
} from "@/lib/menu-generator/applyWeekMenuMapper";
import { resolveEconomyConfigForCountry } from "@/lib/menu-generator/countryEconomyDefaults";
import { getLocalizedCategoryLabel } from "@/lib/menu-generator/localizedCategoryLabels";
import { FIXED_CATEGORY_KEYS } from "@/lib/menu-generator/types";
import type { ProviderMenuDayRow } from "@/lib/provider-menu/loadProviderMenuDays";
import type { ProviderOrderLockState } from "@/lib/provider-menu/providerMenuOrderLock";

const PROVIDER = "11111111-1111-1111-1111-111111111111";
const WEEK = "2031-02-03";
const DATES = ["2031-02-03", "2031-02-04", "2031-02-05", "2031-02-06", "2031-02-07"];
const EMPTY_LOCK: ProviderOrderLockState = {
  datesWithOrders: new Set(),
  lockedCatalogItemKeys: new Set(),
  orderCountsByDate: new Map(),
  queryFailed: false,
};

function economy(country: string) {
  return resolveEconomyConfigForCountry(country);
}

function mapWeek(locale: string, profileId: string, country: string) {
  return mapGeneratedWeekToApplyTargets({
    providerId: PROVIDER,
    weekStart: WEEK,
    menuLocale: locale as "nb-NO",
    country,
    menuProfileId: profileId as "norwegian_company_lunch",
    packageTier: "LUXUS",
    enabledCategories: FIXED_CATEGORY_KEYS,
    economyConfig: economy(country),
  });
}

describe("applyLocalizedGeneratedWeekMenu", () => {
  it("builds idempotency key deterministically", () => {
    const a = buildApplyIdempotencyKey({
      providerId: PROVIDER,
      weekStart: WEEK,
      menuLocale: "nb-NO",
      menuProfileId: "norwegian_company_lunch",
      overwriteMode: "stop_if_published_exists",
      packageTier: "LUXUS",
    });
    const b = buildApplyIdempotencyKey({
      providerId: PROVIDER,
      weekStart: WEEK,
      menuLocale: "nb-NO",
      menuProfileId: "norwegian_company_lunch",
      overwriteMode: "stop_if_published_exists",
      packageTier: "LUXUS",
    });
    expect(a).toBe(b);
    expect(a).toContain(PROVIDER);
  });

  it("dryRun would_create for 5 missing days", () => {
    const mapped = mapWeek("nb-NO", "norwegian_company_lunch", "NO");
    const { days } = buildApplyWeekDiff({
      weekStart: WEEK,
      dates: DATES,
      existingRows: [],
      varmrettByDate: mapped.varmrettByDate,
      overwriteMode: "create_missing_only",
      dryRun: true,
      lockState: EMPTY_LOCK,
    });
    expect(days).toHaveLength(5);
    expect(days.every((d) => d.status === "would_create")).toBe(true);
    expect(wouldMutateInDryRun(days)).toBe(true);
    const summary = dryRunSummaryFromDays(days);
    expect(summary.createdDraftDays).toBe(5);
  });

  it("create_missing_only skips existing drafts", () => {
    const mapped = mapWeek("nb-NO", "norwegian_company_lunch", "NO");
    const existing: ProviderMenuDayRow[] = [
      {
        id: "x",
        date: DATES[0]!,
        tier: "BASIS",
        category: "varmrett",
        mealTitle: "Eksisterende rett",
        description: "Allerede lagret utkast med innhold.",
        allergens: [],
        estimatedCostPerPortion: null,
        sourcePackage: null,
        upgradeType: null,
        upgradeNote: null,
        approvedForPublish: false,
        customerVisible: false,
        status: "draft",
      },
    ];
    const { days } = buildApplyWeekDiff({
      weekStart: WEEK,
      dates: DATES,
      existingRows: existing,
      varmrettByDate: mapped.varmrettByDate,
      overwriteMode: "create_missing_only",
      dryRun: true,
      lockState: EMPTY_LOCK,
    });
    expect(days[0]?.status).toBe("skipped_existing");
    expect(days.filter((d) => d.status === "would_create")).toHaveLength(4);
  });

  it("replace_drafts_only would_update when content differs", () => {
    const mapped = mapWeek("nb-NO", "norwegian_company_lunch", "NO");
    const generated = mapped.varmrettByDate.get(DATES[0]!);
    expect(generated).toBeTruthy();
    const existing: ProviderMenuDayRow[] = [
      {
        id: "x",
        date: DATES[0]!,
        tier: "BASIS",
        category: "varmrett",
        mealTitle: "Gammel tittel",
        description: "Gammel beskrivelse som er lang nok.",
        allergens: [],
        estimatedCostPerPortion: null,
        sourcePackage: null,
        upgradeType: null,
        upgradeNote: null,
        approvedForPublish: false,
        customerVisible: false,
        status: "draft",
      },
    ];
    const { days } = buildApplyWeekDiff({
      weekStart: WEEK,
      dates: [DATES[0]!],
      existingRows: existing,
      varmrettByDate: mapped.varmrettByDate,
      overwriteMode: "replace_drafts_only",
      dryRun: true,
      lockState: EMPTY_LOCK,
    });
    expect(days[0]?.status).toBe("would_update_draft");
    expect(days[0]?.diff.length).toBeGreaterThan(0);
  });

  it("stop_if_published_exists blocks when published day exists", () => {
    const mapped = mapWeek("nb-NO", "norwegian_company_lunch", "NO");
    const existing: ProviderMenuDayRow[] = [
      {
        id: "pub",
        date: DATES[2]!,
        tier: "BASIS",
        category: "varmrett",
        mealTitle: "Publisert rett",
        description: "Publisert beskrivelse med innhold.",
        allergens: [],
        estimatedCostPerPortion: null,
        sourcePackage: null,
        upgradeType: null,
        upgradeNote: null,
        approvedForPublish: true,
        customerVisible: true,
        status: "published",
      },
    ];
    const { days, blockedReasons } = buildApplyWeekDiff({
      weekStart: WEEK,
      dates: DATES,
      existingRows: existing,
      varmrettByDate: mapped.varmrettByDate,
      overwriteMode: "stop_if_published_exists",
      dryRun: true,
      lockState: EMPTY_LOCK,
    });
    expect(blockedReasons.length).toBeGreaterThan(0);
    expect(days.every((d) => d.status === "blocked_published")).toBe(true);
  });

  it("never would_update published days", () => {
    const mapped = mapWeek("de-DE", "german_business_lunch", "DE");
    const existing: ProviderMenuDayRow[] = [
      {
        id: "pub",
        date: DATES[0]!,
        tier: "BASIS",
        category: "varmrett",
        mealTitle: "Published",
        description: "Published description content.",
        allergens: [],
        estimatedCostPerPortion: null,
        sourcePackage: null,
        upgradeType: null,
        upgradeNote: null,
        approvedForPublish: true,
        customerVisible: true,
        status: "published",
      },
    ];
    const { days } = buildApplyWeekDiff({
      weekStart: WEEK,
      dates: [DATES[0]!],
      existingRows: existing,
      varmrettByDate: mapped.varmrettByDate,
      overwriteMode: "replace_drafts_only",
      dryRun: true,
      lockState: EMPTY_LOCK,
    });
    expect(days[0]?.status).toBe("skipped_published");
  });

  it("de-DE uses German dish titles in generated varmrett", () => {
    const mapped = mapWeek("de-DE", "german_business_lunch", "DE");
    const first = mapped.varmrettByDate.get(DATES[0]!);
    expect(first?.mealTitle).toBeTruthy();
    expect(first?.mealTitle.toLowerCase()).not.toContain("påsmurt");
    expect(first?.mealTitle.toLowerCase()).not.toContain("salatboks");
    expect(getLocalizedCategoryLabel("de-DE", "sandwich")).toBe("Belegte Brötchen");
  });

  it("sv-SE and da-DK locale mapping", () => {
    const sv = mapWeek("sv-SE", "swedish_lunch", "SE");
    const da = mapWeek("da-DK", "danish_office_lunch", "DK");
    expect(sv.varmrettByDate.size).toBe(5);
    expect(da.varmrettByDate.size).toBe(5);
    expect(getLocalizedCategoryLabel("sv-SE", "sandwich")).toBe("Mackor");
    expect(getLocalizedCategoryLabel("da-DK", "salad")).toBe("Salater");
  });

  it("all 9 locales supported for apply menuLocale", () => {
    const locales = [
      ["nb-NO", "norwegian_company_lunch", "NO"],
      ["sv-SE", "swedish_lunch", "SE"],
      ["da-DK", "danish_office_lunch", "DK"],
      ["fi-FI", "finnish_office_lunch", "FI"],
      ["de-DE", "german_business_lunch", "DE"],
      ["en-GB", "uk_office_lunch", "GB"],
      ["fr-FR", "french_dejeuner", "FR"],
      ["es-ES", "spanish_menu_del_dia", "ES"],
      ["it-IT", "italian_office_lunch", "IT"],
    ] as const;
    for (const [locale, profile, country] of locales) {
      expect(isSupportedApplyMenuLocale(locale)).toBe(true);
      const mapped = mapWeek(locale, profile, country);
      expect(mapped.varmrettByDate.size).toBe(5);
    }
  });

  it("enterprise hotMeal identity stable for premium upgrade", () => {
    const mapped = mapGeneratedWeekToApplyTargets({
      providerId: PROVIDER,
      weekStart: WEEK,
      menuLocale: "nb-NO",
      country: "NO",
      menuProfileId: "norwegian_company_lunch",
      packageTier: "ENTERPRISE",
      enabledCategories: FIXED_CATEGORY_KEYS,
      economyConfig: economy("NO"),
    });
    const day = mapped.generated.days[0];
    const hot = day?.choices.find((c) => c.categoryKey === "hotMeal");
    const premium = day?.choices.find((c) => c.categoryKey === "premiumUpgrade");
    const hotState = hot ? mapped.varmrettByDate.get(day!.date) : null;
    expect(hotState).toBeTruthy();
    if (hot && premium && hotState) {
      expect(enterpriseHotMealIdentityStable(hotState, premium)).toBe(true);
      expect(premium.hotMealBaseItemKey).toBe(hot.itemKey);
    }
  });

  it("stable itemKey includes locale category slug", () => {
    const mapped = mapWeek("nb-NO", "norwegian_company_lunch", "NO");
    const first = mapped.varmrettByDate.get(DATES[0]!);
    expect(first?.itemKey).toMatch(/^nb-NO:hotMeal:/);
    expect(first?.slug).toBeTruthy();
  });

  it("formats allergens for menuDay without Norwegian leak in de-DE", () => {
    const text = formatAllergensForMenuDay(["melk", "gluten"], "de-DE");
    expect(text).toContain("Milch");
    expect(text).not.toContain("Melk");
  });

  it("second identical apply shows unchanged when draft matches", () => {
    const mapped = mapWeek("nb-NO", "norwegian_company_lunch", "NO");
    const generated = mapped.varmrettByDate.get(DATES[0]!);
    const existing: ProviderMenuDayRow[] = [
      {
        id: "x",
        date: DATES[0]!,
        tier: "BASIS",
        category: "varmrett",
        mealTitle: generated!.mealTitle,
        description: generated!.description,
        allergens: generated!.allergensText.split(", "),
        estimatedCostPerPortion: null,
        sourcePackage: null,
        upgradeType: null,
        upgradeNote: null,
        approvedForPublish: false,
        customerVisible: false,
        status: "draft",
      },
    ];
    const { days } = buildApplyWeekDiff({
      weekStart: WEEK,
      dates: [DATES[0]!],
      existingRows: existing,
      varmrettByDate: mapped.varmrettByDate,
      overwriteMode: "replace_drafts_only",
      dryRun: true,
      lockState: EMPTY_LOCK,
    });
    expect(days[0]?.status).toBe("unchanged");
    expect(wouldMutateInDryRun(days)).toBe(false);
  });
});
