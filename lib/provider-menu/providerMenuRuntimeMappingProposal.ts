/**
 * G5d.2 — Runtime mapping proposal view model (read-only, shadow-only).
 *
 * Transforms G5d.1 MenuProfileRuntimeMapping into provider workspace proposal UI data.
 * Does not change catalog keys, save payloads, publish, or order paths.
 */

import {
  isMenuProfileRuntimeMappingProposalPanelEnabled,
  type EnvLike,
} from "@/lib/menu-profile/featureFlag";
import type { MenuProfileRuntimeMapping } from "@/lib/menu-profile/runtimeMappingTypes";
import type {
  MenuProfile,
  MenuProfileResolverResult,
  PackageKey,
} from "@/lib/menu-profile/types";
import type { MenuProfileFixedCategoryPresentation } from "@/lib/provider-menu/providerMenuProfileFixedCategories";
import type { MenuProfileWarmDishPreview } from "@/lib/provider-menu/providerMenuProfileWarmDishPreview";

export type RuntimeMappingProposalCategoryStatus =
  | "mapped_existing_no_runtime"
  | "shadow_only_non_no"
  | "presentation_only"
  | "unsupported"
  | "enterprise_upgrade";

export type RuntimeMappingProposalWarmDishStatus = "preview_only" | "not_publishable";

export type RuntimeMappingProposalCategoryExplanationKey =
  | "existingNoRuntimeMapping"
  | "notRuntimeSupportedYet"
  | "presentationOnly"
  | "unsupportedMapping"
  | "enterpriseUpgradeNotOrderCategory";

export type RuntimeMappingProposalWarmDishExplanationKey =
  | "previewOnly"
  | "notPublishable";

export type ProviderMenuRuntimeMappingProposalCategory = {
  profileCategoryKey: string;
  profileLabel: string;
  runtimeCategoryKey: string | null;
  runtimeLunchCategoryKey: string | null;
  runtimeOrderChoiceKey: string | null;
  packageTiers: readonly PackageKey[];
  status: RuntimeMappingProposalCategoryStatus;
  canSaveToMenuDay: false;
  canSaveToCatalog: false;
  canPublish: false;
  canOrder: false;
  explanationLabelKey: RuntimeMappingProposalCategoryExplanationKey;
};

export type ProviderMenuRuntimeMappingProposalWarmDish = {
  warmDishPreviewId: string;
  title: string;
  runtimeCategoryKey: string | null;
  runtimeOrderChoiceKey: string | null;
  status: RuntimeMappingProposalWarmDishStatus;
  canApplyToMenu: false;
  canPublish: false;
  canOrder: false;
  explanationLabelKey: RuntimeMappingProposalWarmDishExplanationKey;
};

export type ProviderMenuRuntimeMappingProposalSummary = {
  mappedCategoryCount: number;
  unmappedCategoryCount: number;
  previewOnlyWarmDishCount: number;
  runtimeEnabledCount: 0;
  canSaveCount: 0;
  canPublishCount: 0;
  canOrderCount: 0;
};

export type ProviderMenuRuntimeMappingProposal = {
  profileId: string;
  market: string;
  locale: string;
  currency: string;
  mappingVersion: string;
  isRuntimeEnabled: false;
  isShadowOnly: true;
  categories: readonly ProviderMenuRuntimeMappingProposalCategory[];
  warmDishPreview: readonly ProviderMenuRuntimeMappingProposalWarmDish[];
  warnings: readonly string[];
  summary: ProviderMenuRuntimeMappingProposalSummary;
  linkedFixedCategoriesActive: boolean;
  linkedWarmDishPreviewActive: boolean;
};

export type ProviderMenuRuntimeMappingProposalProps =
  | { active: false }
  | ({ active: true } & ProviderMenuRuntimeMappingProposal);

function categoryStatusFromReason(
  reasonCode: MenuProfileRuntimeMapping["categories"][number]["reasonCode"],
): RuntimeMappingProposalCategoryStatus {
  switch (reasonCode) {
    case "existing_no_runtime_mapping":
      return "mapped_existing_no_runtime";
    case "non_no_market_shadow_only":
      return "shadow_only_non_no";
    case "enterprise_upgrade_not_order_category":
      return "enterprise_upgrade";
    case "missing_runtime_mapping":
      return "unsupported";
    case "profile_key_not_runtime_supported":
    case "warm_dish_preview_only":
      return "presentation_only";
    default:
      return "unsupported";
  }
}

function categoryExplanationKey(
  status: RuntimeMappingProposalCategoryStatus,
): RuntimeMappingProposalCategoryExplanationKey {
  switch (status) {
    case "mapped_existing_no_runtime":
      return "existingNoRuntimeMapping";
    case "shadow_only_non_no":
      return "notRuntimeSupportedYet";
    case "enterprise_upgrade":
      return "enterpriseUpgradeNotOrderCategory";
    case "presentation_only":
      return "presentationOnly";
    case "unsupported":
      return "unsupportedMapping";
  }
}

function warmDishStatusFromReason(
  reasonCode: MenuProfileRuntimeMapping["warmDishPreview"][number]["reasonCode"],
): RuntimeMappingProposalWarmDishStatus {
  return reasonCode === "warm_dish_preview_only" ? "preview_only" : "not_publishable";
}

function warmDishExplanationKey(
  status: RuntimeMappingProposalWarmDishStatus,
): RuntimeMappingProposalWarmDishExplanationKey {
  return status === "preview_only" ? "previewOnly" : "notPublishable";
}

function buildWarnings(proposal: Omit<ProviderMenuRuntimeMappingProposal, "warnings">): string[] {
  const warnings: string[] = [];
  if (proposal.summary.unmappedCategoryCount > 0) {
    warnings.push("unmappedCategories");
  }
  if (proposal.summary.previewOnlyWarmDishCount > 0) {
    warnings.push("previewOnlyWarmDishes");
  }
  const enterprise = proposal.categories.find((c) => c.status === "enterprise_upgrade");
  if (enterprise) {
    warnings.push("enterpriseUpgradeNotOrderCategory");
  }
  if (proposal.market !== "NO") {
    warnings.push("nonNoMarketShadowOnly");
  }
  return warnings;
}

export function buildProviderMenuRuntimeMappingProposal(input: {
  menuProfile: MenuProfile;
  runtimeMapping: MenuProfileRuntimeMapping;
  currency: string;
  locale?: string;
  fixedCategoryPresentation?: MenuProfileFixedCategoryPresentation | null;
  warmDishPreview?: MenuProfileWarmDishPreview | null;
}): ProviderMenuRuntimeMappingProposal {
  const { menuProfile, runtimeMapping, currency } = input;
  const locale = input.locale ?? menuProfile.locale;

  const categories: ProviderMenuRuntimeMappingProposalCategory[] = runtimeMapping.categories.map(
    (category) => {
      const status = categoryStatusFromReason(category.reasonCode);
      return {
        profileCategoryKey: category.profileCategoryKey,
        profileLabel: category.profileLabel,
        runtimeCategoryKey: category.runtimeCategoryKey,
        runtimeLunchCategoryKey: category.runtimeLunchCategoryKey,
        runtimeOrderChoiceKey: category.runtimeOrderChoiceKey,
        packageTiers: category.packageTiers,
        status,
        canSaveToMenuDay: false,
        canSaveToCatalog: false,
        canPublish: false,
        canOrder: false,
        explanationLabelKey: categoryExplanationKey(status),
      };
    },
  );

  const warmDishPreview: ProviderMenuRuntimeMappingProposalWarmDish[] =
    runtimeMapping.warmDishPreview.map((item) => {
      const status = warmDishStatusFromReason(item.reasonCode);
      return {
        warmDishPreviewId: item.warmDishPreviewId,
        title: item.title,
        runtimeCategoryKey: item.runtimeCategoryKey,
        runtimeOrderChoiceKey: item.runtimeOrderChoiceKey,
        status,
        canApplyToMenu: false,
        canPublish: false,
        canOrder: false,
        explanationLabelKey: warmDishExplanationKey(status),
      };
    });

  const mappedCategoryCount = categories.filter(
    (c) => c.status === "mapped_existing_no_runtime",
  ).length;
  const unmappedCategoryCount = categories.filter(
    (c) =>
      c.status !== "mapped_existing_no_runtime" && c.status !== "enterprise_upgrade",
  ).length;
  const previewOnlyWarmDishCount = warmDishPreview.filter(
    (w) => w.status === "preview_only",
  ).length;

  const base: Omit<ProviderMenuRuntimeMappingProposal, "warnings"> = {
    profileId: menuProfile.id,
    market: menuProfile.market,
    locale,
    currency,
    mappingVersion: runtimeMapping.mappingVersion,
    isRuntimeEnabled: false,
    isShadowOnly: true,
    categories,
    warmDishPreview,
    summary: {
      mappedCategoryCount,
      unmappedCategoryCount,
      previewOnlyWarmDishCount,
      runtimeEnabledCount: 0,
      canSaveCount: 0,
      canPublishCount: 0,
      canOrderCount: 0,
    },
    linkedFixedCategoriesActive: Boolean(input.fixedCategoryPresentation?.active),
    linkedWarmDishPreviewActive: Boolean(input.warmDishPreview),
  };

  return {
    ...base,
    warnings: buildWarnings(base),
  };
}

/** Throws when any proposal entry accidentally enables runtime cutover. */
export function assertNoRuntimeEnablement(proposal: ProviderMenuRuntimeMappingProposal): void {
  if (proposal.isRuntimeEnabled) {
    throw new Error("ProviderMenuRuntimeMappingProposal.isRuntimeEnabled must remain false in G5d.2");
  }
  if (!proposal.isShadowOnly) {
    throw new Error("ProviderMenuRuntimeMappingProposal.isShadowOnly must remain true in G5d.2");
  }

  if (proposal.summary.runtimeEnabledCount !== 0) {
    throw new Error("summary.runtimeEnabledCount must remain 0 in G5d.2");
  }
  if (proposal.summary.canSaveCount !== 0) {
    throw new Error("summary.canSaveCount must remain 0 in G5d.2");
  }
  if (proposal.summary.canPublishCount !== 0) {
    throw new Error("summary.canPublishCount must remain 0 in G5d.2");
  }
  if (proposal.summary.canOrderCount !== 0) {
    throw new Error("summary.canOrderCount must remain 0 in G5d.2");
  }

  for (const category of proposal.categories) {
    if (category.canSaveToMenuDay) {
      throw new Error(`Category ${category.profileCategoryKey}: canSaveToMenuDay must remain false`);
    }
    if (category.canSaveToCatalog) {
      throw new Error(`Category ${category.profileCategoryKey}: canSaveToCatalog must remain false`);
    }
    if (category.canPublish) {
      throw new Error(`Category ${category.profileCategoryKey}: canPublish must remain false`);
    }
    if (category.canOrder) {
      throw new Error(`Category ${category.profileCategoryKey}: canOrder must remain false`);
    }
  }

  for (const warmDish of proposal.warmDishPreview) {
    if (warmDish.canApplyToMenu) {
      throw new Error(`Warm dish ${warmDish.warmDishPreviewId}: canApplyToMenu must remain false`);
    }
    if (warmDish.canPublish) {
      throw new Error(`Warm dish ${warmDish.warmDishPreviewId}: canPublish must remain false`);
    }
    if (warmDish.canOrder) {
      throw new Error(`Warm dish ${warmDish.warmDishPreviewId}: canOrder must remain false`);
    }
  }
}

/**
 * Build client-safe runtime mapping proposal from resolver result.
 * Returns inactive unless G5a resolver + G5d.2 proposal flag are ON and resolver succeeded.
 */
export function buildProviderMenuRuntimeMappingProposalPresentation(
  resolverResult: MenuProfileResolverResult | null | undefined,
  defaultCurrency: string,
  runtimeMapping: MenuProfileRuntimeMapping | null,
  env: EnvLike = {},
  options?: {
    fixedCategoryPresentation?: MenuProfileFixedCategoryPresentation | null;
    warmDishPreview?: MenuProfileWarmDishPreview | null;
  },
): ProviderMenuRuntimeMappingProposalProps {
  if (!isMenuProfileRuntimeMappingProposalPanelEnabled(env)) {
    return { active: false };
  }

  if (!resolverResult?.ok || !resolverResult.enabled || !runtimeMapping) {
    return { active: false };
  }

  const proposal = buildProviderMenuRuntimeMappingProposal({
    menuProfile: resolverResult.profile,
    runtimeMapping,
    currency: defaultCurrency || resolverResult.profile.market,
    locale: resolverResult.profile.locale,
    fixedCategoryPresentation: options?.fixedCategoryPresentation?.active
      ? options.fixedCategoryPresentation
      : null,
    warmDishPreview: options?.warmDishPreview ?? null,
  });

  assertNoRuntimeEnablement(proposal);

  return { active: true, ...proposal };
}
