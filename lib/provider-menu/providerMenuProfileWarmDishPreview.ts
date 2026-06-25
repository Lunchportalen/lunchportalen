/**
 * G5c — Menu profile warm dish bank preview (read-only).
 *
 * Behind LP_MENU_PROFILE_RESOLVER + LP_MENU_PROFILE_WARM_DISH_PREVIEW.
 * Does not change catalog keys, save payloads, publish, or order paths.
 */

import type { PlanTier } from "@/lib/cms/menuDayContract";
import {
  isMenuProfileWarmDishPreviewPanelEnabled,
  type EnvLike,
} from "@/lib/menu-profile/featureFlag";
import { getWarmDishBankSeedsForProfile } from "@/lib/menu-profile/warmDishBankSeeds";
import type {
  MenuProfile,
  MenuProfileResolverResult,
  PackageKey,
  WarmDishBankSeed,
} from "@/lib/menu-profile/types";

export type MenuProfileWarmDishPreviewStatusKey = "previewOnly";
export type MenuProfileWarmDishPreviewHelpKey = "notPublishedHelp";

export type MenuProfileWarmDishPreviewItem = {
  id: string;
  profileId: string;
  countryCode: string;
  title: string;
  description: string | null;
  suggestedAllergens: string[];
  suggestedTags: string[];
  suggestedTiers: PlanTier[];
  suggestedWeekday: string | null;
  isVegetarian: boolean;
  isWarmDish: true;
  isPreviewOnly: true;
  isProviderOwned: false;
  canApplyToMenu: false;
  canPublish: false;
  statusLabelKey: MenuProfileWarmDishPreviewStatusKey;
  helpTextKey: MenuProfileWarmDishPreviewHelpKey;
};

export type MenuProfileWarmDishPreview = {
  profileId: string;
  countryCode: string;
  marketLabel: string;
  locale: string;
  currency: string;
  previewOnly: true;
  publishRuntimeEnabled: false;
  orderRuntimeEnabled: false;
  items: MenuProfileWarmDishPreviewItem[];
};

export type MenuProfileWarmDishPreviewPresentationProps =
  | { active: false }
  | ({ active: true } & MenuProfileWarmDishPreview);

const PACKAGE_KEY_TO_TIER: Record<PackageKey, PlanTier> = {
  basis: "BASIS",
  luxus: "LUXUS",
  enterprise: "ENTERPRISE",
};

const PACKAGE_KEYS: PackageKey[] = ["basis", "luxus", "enterprise"];

const WEEKDAY_SUGGESTIONS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;

function warmDishCategoryKey(profile: MenuProfile): string | null {
  const warm = profile.fixedChoiceCategories.find((c) => c.kind === "warm_dish");
  return warm?.key ?? null;
}

function suggestedTiersForWarmDish(profile: MenuProfile): PlanTier[] {
  const warmKey = warmDishCategoryKey(profile);
  if (!warmKey) return ["BASIS", "LUXUS", "ENTERPRISE"];

  const tiers: PlanTier[] = [];
  for (const pkgKey of PACKAGE_KEYS) {
    const pkg = profile.packageModel[pkgKey];
    if (pkg.categoryKeys.includes(warmKey)) {
      tiers.push(PACKAGE_KEY_TO_TIER[pkgKey]);
    }
  }
  return tiers.length > 0 ? tiers : ["BASIS", "LUXUS", "ENTERPRISE"];
}

function previewId(profileId: string, seedKey: string): string {
  return `warm-dish-preview:${profileId}:${seedKey}`;
}

function seedToPreviewItem(
  seed: WarmDishBankSeed,
  profile: MenuProfile,
  index: number,
  suggestedTiers: PlanTier[],
): MenuProfileWarmDishPreviewItem {
  const tags = [...(seed.tags ?? [])];
  const isVegetarian =
    seed.protein === "vegetarian" || tags.some((t) => t.toLowerCase() === "vegetarian");

  return {
    id: previewId(profile.id, seed.key),
    profileId: profile.id,
    countryCode: profile.market,
    title: seed.title,
    description: seed.description ?? null,
    suggestedAllergens: [...(seed.allergens ?? [])],
    suggestedTags: tags,
    suggestedTiers,
    suggestedWeekday: WEEKDAY_SUGGESTIONS[index] ?? null,
    isVegetarian,
    isWarmDish: true,
    isPreviewOnly: true,
    isProviderOwned: false,
    canApplyToMenu: false,
    canPublish: false,
    statusLabelKey: "previewOnly",
    helpTextKey: "notPublishedHelp",
  };
}

export function buildMenuProfileWarmDishPreview(input: {
  profile: MenuProfile;
  warmDishBankSeeds: readonly WarmDishBankSeed[];
  locale: string;
  market: string;
  currency: string;
}): MenuProfileWarmDishPreview {
  const { profile, warmDishBankSeeds, locale, market, currency } = input;
  const suggestedTiers = suggestedTiersForWarmDish(profile);

  const items = warmDishBankSeeds.map((seed, index) =>
    seedToPreviewItem(seed, profile, index, suggestedTiers),
  );

  return {
    profileId: profile.id,
    countryCode: profile.market,
    marketLabel: market,
    locale,
    currency,
    previewOnly: true,
    publishRuntimeEnabled: false,
    orderRuntimeEnabled: false,
    items,
  };
}

/**
 * Build client-safe warm dish preview from resolver result.
 * Returns inactive unless both G5a and G5c flags are ON and resolver succeeded.
 */
export function buildProviderMenuWarmDishPreviewPresentation(
  resolverResult: MenuProfileResolverResult | null | undefined,
  defaultCurrency: string,
  env: EnvLike = {},
): MenuProfileWarmDishPreviewPresentationProps {
  if (!isMenuProfileWarmDishPreviewPanelEnabled(env)) {
    return { active: false };
  }

  if (!resolverResult?.ok || !resolverResult.enabled) {
    return { active: false };
  }

  const profile = resolverResult.profile;
  const seeds = getWarmDishBankSeedsForProfile(profile.id);
  const preview = buildMenuProfileWarmDishPreview({
    profile,
    warmDishBankSeeds: seeds,
    locale: profile.locale,
    market: profile.market,
    currency: defaultCurrency || profile.market,
  });

  return { active: true, ...preview };
}
