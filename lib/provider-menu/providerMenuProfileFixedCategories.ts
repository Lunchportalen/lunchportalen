/**
 * G5b — Menu profile fixed workspace category presentation (read-only).
 *
 * Behind LP_MENU_PROFILE_RESOLVER + LP_MENU_PROFILE_FIXED_CATEGORIES.
 * Does not change catalog keys, save payloads, publish, or order paths.
 */

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import {
  isMenuProfileFixedCategoriesPanelEnabled,
  type EnvLike,
} from "@/lib/menu-profile/featureFlag";
import { resolveNoCategoryRuntimeMapping } from "@/lib/menu-profile/noCategoryRuntimeMap";
import type {
  MenuCategoryKind,
  MenuProfile,
  MenuProfileResolverResult,
  PackageKey,
} from "@/lib/menu-profile/types";

export type MenuProfileFixedCategoryStatusKey =
  | "activeInCurrentCatalog"
  | "comingStructureNotOrderActive";

export type MenuProfileFixedCategoryHelpKey = "orderRuntimeEnabled" | "presentationOnly";

export type MenuProfileFixedCategoryItem = {
  profileCategoryKey: string;
  runtimeCategoryKey: Category | null;
  runtimeLunchCategoryKey: string | null;
  runtimeOrderChoiceKey: string | null;
  displayLabel: string;
  kind: MenuCategoryKind;
  packageTiers: PlanTier[];
  packageTierLabels: string[];
  isPresentationOnly: boolean;
  isOrderRuntimeEnabled: boolean;
  statusLabelKey: MenuProfileFixedCategoryStatusKey;
  helpTextKey: MenuProfileFixedCategoryHelpKey;
};

export type MenuProfileFixedCategoryPresentation = {
  active: true;
  profileId: string;
  market: string;
  locale: string;
  currency: string;
  categories: MenuProfileFixedCategoryItem[];
};

export type MenuProfileFixedCategoryPresentationProps =
  | { active: false }
  | MenuProfileFixedCategoryPresentation;

const PACKAGE_KEY_TO_TIER: Record<PackageKey, PlanTier> = {
  basis: "BASIS",
  luxus: "LUXUS",
  enterprise: "ENTERPRISE",
};

const PACKAGE_KEYS: PackageKey[] = ["basis", "luxus", "enterprise"];

function packageTiersForCategory(profile: MenuProfile, categoryKey: string): {
  tiers: PlanTier[];
  labels: string[];
} {
  const tiers: PlanTier[] = [];
  const labels: string[] = [];
  for (const pkgKey of PACKAGE_KEYS) {
    const pkg = profile.packageModel[pkgKey];
    if (pkg.categoryKeys.includes(categoryKey)) {
      tiers.push(PACKAGE_KEY_TO_TIER[pkgKey]);
      labels.push(pkg.label);
    }
  }
  return { tiers, labels };
}

function buildCategoryItem(
  profile: MenuProfile,
  categoryKey: string,
  displayLabel: string,
  kind: MenuCategoryKind,
): MenuProfileFixedCategoryItem {
  const { tiers, labels } = packageTiersForCategory(profile, categoryKey);

  if (profile.market === "NO") {
    const mapping = resolveNoCategoryRuntimeMapping(categoryKey);
    if (mapping) {
      return {
        profileCategoryKey: categoryKey,
        runtimeCategoryKey: mapping.runtimeCategoryKey,
        runtimeLunchCategoryKey: mapping.runtimeLunchCategoryKey,
        runtimeOrderChoiceKey: mapping.runtimeOrderChoiceKey,
        displayLabel,
        kind,
        packageTiers: tiers,
        packageTierLabels: labels,
        isPresentationOnly: false,
        isOrderRuntimeEnabled: true,
        statusLabelKey: "activeInCurrentCatalog",
        helpTextKey: "orderRuntimeEnabled",
      };
    }
  }

  return {
    profileCategoryKey: categoryKey,
    runtimeCategoryKey: null,
    runtimeLunchCategoryKey: null,
    runtimeOrderChoiceKey: null,
    displayLabel,
    kind,
    packageTiers: tiers,
    packageTierLabels: labels,
    isPresentationOnly: true,
    isOrderRuntimeEnabled: false,
    statusLabelKey: "comingStructureNotOrderActive",
    helpTextKey: "presentationOnly",
  };
}

export function buildMenuProfileFixedCategoryPresentation(input: {
  profile: MenuProfile;
  currency: string;
}): MenuProfileFixedCategoryPresentation {
  const { profile, currency } = input;

  const categories = profile.fixedChoiceCategories.map((cat) =>
    buildCategoryItem(profile, cat.key, cat.label, cat.kind),
  );

  return {
    active: true,
    profileId: profile.id,
    market: profile.market,
    locale: profile.locale,
    currency,
    categories,
  };
}

/**
 * Build client-safe fixed category presentation from resolver result.
 * Returns inactive unless both G5a and G5b flags are ON and resolver succeeded.
 */
export function buildProviderMenuFixedCategoryPresentation(
  resolverResult: MenuProfileResolverResult | null | undefined,
  defaultCurrency: string,
  env: EnvLike = {},
): MenuProfileFixedCategoryPresentationProps {
  if (!isMenuProfileFixedCategoriesPanelEnabled(env)) {
    return { active: false };
  }

  if (!resolverResult?.ok || !resolverResult.enabled) {
    return { active: false };
  }

  return buildMenuProfileFixedCategoryPresentation({
    profile: resolverResult.profile,
    currency: defaultCurrency || resolverResult.profile.market,
  });
}
