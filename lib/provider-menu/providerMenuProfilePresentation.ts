/**
 * G5a — Menu profile workspace presentation (read-only, behind LP_MENU_PROFILE_RESOLVER).
 *
 * Maps resolved MenuProfile metadata to provider menu workspace labels/explanations only.
 * Does not change catalog keys, save payloads, publish, or order paths.
 */

import type { PlanTier } from "@/lib/cms/menuDayContract";
import type {
  MenuProfile,
  MenuProfileResolverResult,
  PackageKey,
} from "@/lib/menu-profile/types";
import { getTierDisplayLabel } from "@/lib/tiers/displayLabels";

export type ProviderMenuProfilePresentationMeta = {
  profileId: string;
  profileName: string;
  market: string;
  locale: string;
  defaultCurrency: string;
  source: string;
};

export type ProviderMenuProfilePackageTierPresentation = {
  tier: PlanTier;
  title: string;
  text: string;
};

export type ProviderMenuProfileCalloutPresentation = {
  title: string;
  text: string;
};

export type ProviderMenuWorkspacePresentation = {
  active: true;
  meta: ProviderMenuProfilePresentationMeta;
  packageTiers: ProviderMenuProfilePackageTierPresentation[];
  tierContext: Record<PlanTier, string>;
  sharedWarmDish: ProviderMenuProfileCalloutPresentation;
  enterpriseUpgrade: ProviderMenuProfileCalloutPresentation;
};

export type ProviderMenuWorkspacePresentationProps =
  | { active: false }
  | ProviderMenuWorkspacePresentation;

const PACKAGE_KEY_TO_TIER: Record<PackageKey, PlanTier> = {
  basis: "BASIS",
  luxus: "LUXUS",
  enterprise: "ENTERPRISE",
};

const TIER_TO_PACKAGE_KEY: Record<PlanTier, PackageKey> = {
  BASIS: "basis",
  LUXUS: "luxus",
  ENTERPRISE: "enterprise",
};

export function categoryLabelFromMenuProfile(profile: MenuProfile, categoryKey: string): string {
  const fromFixed = profile.fixedChoiceCategories.find((c) => c.key === categoryKey);
  if (fromFixed) return fromFixed.label;
  if (categoryKey === "enterprise_upgrade") {
    return profile.enterpriseUpgradeModel?.label ?? "Enterprise upgrade";
  }
  return categoryKey;
}

function warmDishCategoryFromProfile(profile: MenuProfile) {
  return profile.fixedChoiceCategories.find((c) => c.kind === "warm_dish") ?? null;
}

function packageCategoryLabels(profile: MenuProfile, categoryKeys: readonly string[]): string[] {
  return categoryKeys
    .filter((key) => key !== "enterprise_upgrade")
    .map((key) => categoryLabelFromMenuProfile(profile, key));
}

function buildPackageTierText(profile: MenuProfile, packageKey: PackageKey): string {
  const pkg = profile.packageModel[packageKey];
  const labels = packageCategoryLabels(profile, pkg.categoryKeys);
  if (packageKey === "enterprise" && profile.enterpriseUpgradeModel) {
    const base = labels.join(", ");
    return `${base}. ${profile.enterpriseUpgradeModel.label}.`;
  }
  return labels.join(", ");
}

function buildTierContext(profile: MenuProfile, tier: PlanTier): string {
  const packageKey = TIER_TO_PACKAGE_KEY[tier];
  const pkg = profile.packageModel[packageKey];
  const labels = packageCategoryLabels(profile, pkg.categoryKeys);
  const tierLabel = getTierDisplayLabel(tier, profile.locale);

  if (tier === "ENTERPRISE" && profile.enterpriseUpgradeModel) {
    return `${tierLabel}: ${labels.join(", ")}. ${profile.enterpriseUpgradeModel.description}`;
  }

  return `${tierLabel}: ${labels.join(", ")}.`;
}

export function buildMenuProfileWorkspacePresentation(
  profile: MenuProfile,
  meta: Omit<ProviderMenuProfilePresentationMeta, "profileId" | "profileName" | "market" | "locale"> & {
    profileId: string;
    profileName: string;
    market: string;
    locale: string;
  },
): ProviderMenuWorkspacePresentation {
  const warmDish = warmDishCategoryFromProfile(profile);
  const enterprise = profile.enterpriseUpgradeModel;

  const packageTiers = (Object.keys(PACKAGE_KEY_TO_TIER) as PackageKey[]).map((packageKey) => ({
    tier: PACKAGE_KEY_TO_TIER[packageKey],
    title: getTierDisplayLabel(PACKAGE_KEY_TO_TIER[packageKey], profile.locale),
    text: buildPackageTierText(profile, packageKey),
  }));

  return {
    active: true,
    meta,
    packageTiers,
    tierContext: {
      BASIS: buildTierContext(profile, "BASIS"),
      LUXUS: buildTierContext(profile, "LUXUS"),
      ENTERPRISE: buildTierContext(profile, "ENTERPRISE"),
    },
    sharedWarmDish: {
      title: warmDish?.label ?? "Warm dish",
      text:
        warmDish?.description ??
        profile.description ??
        "One shared warm dish per delivery day across Basis, Luxus and Enterprise.",
    },
    enterpriseUpgrade: {
      title: enterprise?.label ?? "Enterprise upgrade",
      text:
        enterprise?.description ??
        "Same warm dish as Luxus with add-ons planned per day in the week plan.",
    },
  };
}

/**
 * Build client-safe workspace presentation from resolver result.
 * Returns inactive when flag OFF, resolver error, or legacy_disabled.
 */
export function buildProviderMenuWorkspacePresentation(
  resolverResult: MenuProfileResolverResult | null | undefined,
  defaultCurrency: string,
): ProviderMenuWorkspacePresentationProps {
  if (!resolverResult?.ok || !resolverResult.enabled) {
    return { active: false };
  }

  const profile = resolverResult.profile;

  return buildMenuProfileWorkspacePresentation(profile, {
    profileId: profile.id,
    profileName: profile.name,
    market: profile.market,
    locale: profile.locale,
    defaultCurrency: defaultCurrency || profile.market,
    source: resolverResult.source,
  });
}
