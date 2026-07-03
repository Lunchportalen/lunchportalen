/**
 * Phase 3 — Profile menu runtime (display + suggestions only).
 *
 * Behind LP_MENU_PROFILE_RESOLVER (default OFF). Does not change category keys,
 * choice_key, item_key, publish payloads, or order write-path.
 */

import type { Category } from "@/lib/cms/menuDayContract";
import { CATEGORY_LABELS, type PlanTier } from "@/lib/cms/menuDayContract";
import { isMenuProfileResolverEnabled, type EnvLike } from "@/lib/menu-profile/featureFlag";
import { resolveNoCategoryRuntimeMapping } from "@/lib/menu-profile/noCategoryRuntimeMap";
import { getMenuProfile } from "@/lib/menu-profile/registry";
import type {
  MarketCode,
  MenuProfile,
  MenuProfileId,
  MenuProfileResolverResult,
  WarmDishBankSeed,
} from "@/lib/menu-profile/types";
import { getWarmDishBankSeedsForProfile } from "@/lib/menu-profile/warmDishBankSeeds";

const RUNTIME_CATEGORIES: readonly Category[] = [
  "paasmurt",
  "salat",
  "sushi",
  "pokebowl",
  "thai",
  "varmrett",
] as const;

/** Profile category key per runtime Category slug — all nine markets. */
const MARKET_RUNTIME_CATEGORY_KEY_MAP: Readonly<Record<MarketCode, Partial<Record<Category, string>>>> = {
  NO: buildNoMarketMap(),
  SE: {
    paasmurt: "smorgas",
    salat: "sallad",
    sushi: "bowl",
    pokebowl: "wrap",
    thai: "bowl",
    varmrett: "varm_lunch",
  },
  DK: {
    paasmurt: "smorrebrod",
    salat: "salat",
    sushi: "bowl",
    pokebowl: "sandwich",
    thai: "bowl",
    varmrett: "varm_frokost",
  },
  FI: {
    paasmurt: "voileipa",
    salat: "salaatti",
    sushi: "bowl",
    pokebowl: "kasvisvaihtoehto",
    thai: "bowl",
    varmrett: "lammin_lounas",
  },
  DE: {
    paasmurt: "belegte_broetchen",
    salat: "salat",
    sushi: "bowl",
    pokebowl: "vegetarische_option",
    thai: "bowl",
    varmrett: "warme_mahlzeit",
  },
  FR: {
    paasmurt: "sandwich_baguette",
    salat: "salade",
    sushi: "quiche_tarte",
    pokebowl: "quiche_tarte",
    thai: "quiche_tarte",
    varmrett: "plat_du_jour",
  },
  ES: {
    paasmurt: "bocadillo",
    salat: "ensalada",
    sushi: "bowl",
    pokebowl: "tapas_style_option",
    thai: "bowl",
    varmrett: "plato_del_dia",
  },
  UK: {
    paasmurt: "sandwiches",
    salat: "salads",
    sushi: "bowls",
    pokebowl: "wraps",
    thai: "bowls",
    varmrett: "hot_lunch",
  },
  IT: {
    paasmurt: "panini",
    salat: "insalata",
    sushi: "bowl",
    pokebowl: "piatto_freddo",
    thai: "bowl",
    varmrett: "primo_del_giorno",
  },
};

function buildNoMarketMap(): Partial<Record<Category, string>> {
  const out: Partial<Record<Category, string>> = {};
  for (const [profileKey, mapping] of Object.entries({
    paasmurt: "paasmurt",
    salatboks: "salat",
    sushi: "sushi",
    pokebowl: "pokebowl",
    thaimat: "thai",
    varmrett: "varmrett",
  })) {
    const resolved = resolveNoCategoryRuntimeMapping(profileKey);
    if (resolved) out[resolved.runtimeCategoryKey] = profileKey;
  }
  return out;
}

export function isProfileMenuRuntimeEnabled(env: EnvLike = {}): boolean {
  return isMenuProfileResolverEnabled(env);
}

export function resolveActiveMenuProfileForRuntime(
  resolverResult: MenuProfileResolverResult | null | undefined,
  env: EnvLike = {},
): MenuProfile | null {
  if (!isProfileMenuRuntimeEnabled(env)) return null;
  if (!resolverResult?.ok) return null;
  if (!resolverResult.enabled) return null;
  return resolverResult.profile;
}

export function profileCategoryKeyForRuntimeCategory(
  profile: MenuProfile,
  category: Category,
): string | null {
  const marketMap = MARKET_RUNTIME_CATEGORY_KEY_MAP[profile.market];
  return marketMap?.[category] ?? null;
}

export function profileLabelForCategoryKey(profile: MenuProfile, profileCategoryKey: string): string | null {
  const fromFixed = profile.fixedChoiceCategories.find((c) => c.key === profileCategoryKey);
  if (fromFixed) return fromFixed.label;
  return null;
}

export function resolveRuntimeCategoryDisplayLabel(
  profile: MenuProfile,
  category: Category,
): string {
  const profileKey = profileCategoryKeyForRuntimeCategory(profile, category);
  if (profileKey) {
    const label = profileLabelForCategoryKey(profile, profileKey);
    if (label) return label;
  }
  return CATEGORY_LABELS[category];
}

export function buildProfileRuntimeCategoryLabels(
  profile: MenuProfile,
): Record<Category, string> {
  const labels = {} as Record<Category, string>;
  for (const category of RUNTIME_CATEGORIES) {
    labels[category] = resolveRuntimeCategoryDisplayLabel(profile, category);
  }
  return labels;
}

export type ProfileRuntimeCategoryLabels = Partial<Record<Category, string>>;

export function buildProfileRuntimeCategoryLabelsFromResolver(
  resolverResult: MenuProfileResolverResult | null | undefined,
  env: EnvLike = {},
): ProfileRuntimeCategoryLabels | null {
  const profile = resolveActiveMenuProfileForRuntime(resolverResult, env);
  if (!profile) return null;
  return buildProfileRuntimeCategoryLabels(profile);
}

export type OrderWindowCategoryLike = {
  key: string;
  category: Category | null;
  label: string;
  title?: string | null;
};

/** Display-only overlay — keys and category slugs unchanged. */
export function overlayProfileLabelsOnOrderWindowCategories<T extends OrderWindowCategoryLike>(
  categories: readonly T[],
  profile: MenuProfile,
): T[] {
  return categories.map((cat) => {
    if (!cat.category) return cat;
    return {
      ...cat,
      label: resolveRuntimeCategoryDisplayLabel(profile, cat.category),
    };
  });
}

export type ProfileWarmDishSuggestion = {
  id: string;
  profileId: MenuProfileId;
  title: string;
  description: string | null;
  suggestedAllergens: string[];
  suggestedTags: string[];
  suggestedTiers: PlanTier[];
  isVegetarian: boolean;
  isPreviewOnly: boolean;
};

export function buildProfileWarmDishSuggestions(profile: MenuProfile): ProfileWarmDishSuggestion[] {
  const seeds = getWarmDishBankSeedsForProfile(profile.id);
  return seeds.map((seed: WarmDishBankSeed) => ({
    id: `profile-warm-dish:${profile.id}:${seed.key}`,
    profileId: profile.id,
    title: seed.title,
    description: seed.description ?? null,
    suggestedAllergens: [...(seed.allergens ?? [])],
    suggestedTags: [...(seed.tags ?? [])],
    suggestedTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
    isVegetarian: seed.tags?.includes("vegetarian") === true,
    isPreviewOnly: true,
  }));
}

export function resolveFallbackMenuProfile(): MenuProfile {
  return getMenuProfile("norwegian_company_lunch");
}

export function MARKET_RUNTIME_CATEGORY_MAP_FOR_TESTS(): Readonly<
  Record<MarketCode, Partial<Record<Category, string>>>
> {
  return MARKET_RUNTIME_CATEGORY_KEY_MAP;
}
