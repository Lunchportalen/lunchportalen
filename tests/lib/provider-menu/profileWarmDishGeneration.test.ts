import { describe, expect, it } from "vitest";

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import { LP_MENU_PROFILE_RESOLVER_ENV } from "@/lib/menu-profile/featureFlag";
import { getMenuProfile } from "@/lib/menu-profile/registry";
import { resolveMenuProfileForProvider } from "@/lib/menu-profile/resolver";
import type { ResolvedProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";
import {
  buildProfileWarmDishWeekSuggestions,
  resolveProfileWarmDishGenerationContext,
} from "@/lib/provider-menu/profileWarmDishGeneration";
import { buildProviderMenuWarmDishGenerationPresentation } from "@/lib/provider-menu/providerMenuProfileWarmDishGeneration";
import { slotKey } from "@/lib/providers/providerMenuPackageSurface";

const ENV_ON = { [LP_MENU_PROFILE_RESOLVER_ENV]: "true" };
const PROVIDER_ID = "00000000-0000-4000-8000-000000000002";
const WEEK_MONDAY = "2026-06-15";
const WEEK_DATES = ["2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19"];

function emptySlot(date: string, tier: PlanTier, category: Category = "varmrett"): ResolvedProviderMenuSlot {
  return {
    date,
    tier,
    category,
    mealTitle: "",
    description: "",
    allergensText: "",
    estimatedCostPerPortion: null,
    sourcePackage: null,
    upgradeType: null,
    upgradeNote: "",
    status: "empty",
    contentSource: "empty",
  };
}

function authoredSlot(date: string, mealTitle: string): ResolvedProviderMenuSlot {
  return {
    ...emptySlot(date, "BASIS"),
    mealTitle,
    description: "Leverandør",
    status: "draft",
    contentSource: "draft",
    providerOverride: true,
  };
}

function publishedSlot(date: string, mealTitle: string): ResolvedProviderMenuSlot {
  return {
    ...authoredSlot(date, mealTitle),
    status: "published",
    contentSource: "published",
  };
}

function slotsForDates(
  dates: readonly string[],
  factory: (date: string) => ResolvedProviderMenuSlot,
): Record<string, ResolvedProviderMenuSlot> {
  const out: Record<string, ResolvedProviderMenuSlot> = {};
  for (const date of dates) {
    for (const tier of ["BASIS", "LUXUS", "ENTERPRISE"] as const) {
      const slot = factory(date);
      out[slotKey(date, tier, "varmrett")] = { ...slot, tier };
    }
  }
  return out;
}

describe("resolveProfileWarmDishGenerationContext", () => {
  it("is inactive when LP_MENU_PROFILE_RESOLVER is OFF", () => {
    const resolver = resolveMenuProfileForProvider({
      menuProfileId: "norwegian_company_lunch",
      env: {},
    });
    expect(resolveProfileWarmDishGenerationContext(resolver, {})).toEqual({ active: false, reason: "flag_off" });
    expect(buildProviderMenuWarmDishGenerationPresentation(resolver, {})).toEqual({ active: false });
  });

  it("is active when resolver ON and profile has warm dish bank", () => {
    const resolver = resolveMenuProfileForProvider({
      menuProfileId: "danish_office_lunch",
      env: ENV_ON,
    });
    const ctx = resolveProfileWarmDishGenerationContext(resolver, ENV_ON);
    expect(ctx.active).toBe(true);
    if (!ctx.active) return;
    expect(ctx.profileId).toBe("danish_office_lunch");
    expect(ctx.seedCount).toBeGreaterThanOrEqual(5);
  });
});

describe("buildProfileWarmDishWeekSuggestions — generation flow safety", () => {
  const profile = getMenuProfile("norwegian_company_lunch");

  it("uses profile bank for empty unlocked days when flag ON", () => {
    const suggestions = buildProfileWarmDishWeekSuggestions({
      providerId: PROVIDER_ID,
      weekMondayIso: WEEK_MONDAY,
      profileId: profile.id,
      profile,
      slots: slotsForDates(WEEK_DATES, (date) => emptySlot(date, "BASIS")),
      lockState: {
        datesWithOrders: new Set<string>(),
        lockedCatalogItemKeys: new Set<string>(),
        orderCountsByDate: new Map<string, number>(),
        queryFailed: false,
      },
    });

    expect(suggestions.source).toBe("profile_bank");
    expect(suggestions.suggestions).toHaveLength(5);
    expect(suggestions.suggestions.every((s) => s.canApply)).toBe(true);
  });

  it("skips provider-authored draft content", () => {
    const suggestions = buildProfileWarmDishWeekSuggestions({
      providerId: PROVIDER_ID,
      weekMondayIso: WEEK_MONDAY,
      profileId: profile.id,
      profile,
      slots: slotsForDates(WEEK_DATES, (date) =>
        date === WEEK_DATES[0] ? authoredSlot(date, "Min egen rett") : emptySlot(date, "BASIS"),
      ),
      lockState: {
        datesWithOrders: new Set<string>(),
        lockedCatalogItemKeys: new Set<string>(),
        orderCountsByDate: new Map<string, number>(),
        queryFailed: false,
      },
    });

    expect(suggestions.suggestions.some((s) => s.date === WEEK_DATES[0])).toBe(false);
    expect(suggestions.skippedDates).toContain(WEEK_DATES[0]);
    expect(suggestions.suggestions).toHaveLength(4);
  });

  it("skips published days without rewriting", () => {
    const suggestions = buildProfileWarmDishWeekSuggestions({
      providerId: PROVIDER_ID,
      weekMondayIso: WEEK_MONDAY,
      profileId: profile.id,
      profile,
      slots: slotsForDates(WEEK_DATES, (date) =>
        date === WEEK_DATES[2] ? publishedSlot(date, "Publisert rett") : emptySlot(date, "BASIS"),
      ),
      lockState: {
        datesWithOrders: new Set<string>(),
        lockedCatalogItemKeys: new Set<string>(),
        orderCountsByDate: new Map<string, number>(),
        queryFailed: false,
      },
    });

    expect(suggestions.suggestions.some((s) => s.date === WEEK_DATES[2])).toBe(false);
    expect(suggestions.skippedDates).toContain(WEEK_DATES[2]);
  });

  it("skips order-locked dates", () => {
    const suggestions = buildProfileWarmDishWeekSuggestions({
      providerId: PROVIDER_ID,
      weekMondayIso: WEEK_MONDAY,
      profileId: profile.id,
      profile,
      slots: slotsForDates(WEEK_DATES, (date) => emptySlot(date, "BASIS")),
      lockState: {
        datesWithOrders: new Set([WEEK_DATES[1]]),
        lockedCatalogItemKeys: new Set<string>(),
        orderCountsByDate: new Map([[WEEK_DATES[1], 1]]),
        queryFailed: false,
      },
    });

    expect(suggestions.suggestions.some((s) => s.date === WEEK_DATES[1])).toBe(false);
    expect(suggestions.skippedDates).toContain(WEEK_DATES[1]);
  });
});

describe("profileWarmDishGeneration — safety boundaries", () => {
  it("does not reference order write-path or lp_order_set", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const files = [
      "lib/provider-menu/profileWarmDishGeneration.ts",
      "lib/provider-menu/generateWeekMenu.ts",
      "app/api/provider/menu-days/varmrett/generate/route.ts",
      "app/api/provider/menu-days/varmrett/suggestions/route.ts",
    ];
    for (const rel of files) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      expect(src).not.toMatch(/lp_order_set/);
      expect(src).not.toMatch(/schemaTypes|defineType/);
    }
  });
});
