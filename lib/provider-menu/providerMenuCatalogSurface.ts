// lib/provider-menu/providerMenuCatalogSurface.ts
// Provider menu builder display: live Sanity lunchCategory + published menuDay overlay.

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import { menuSlotHasContent } from "@/lib/provider-menu/menuCategoryCanonical";
import type { ResolvedProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";
import { resolveProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";
import {
  categoryLabelFromCatalog,
  fixedVariantsFromCatalog,
  workspaceCategoriesFromCatalog,
  type CatalogFixedVariant,
  type ProviderMenuCatalogSnapshot,
} from "@/lib/provider-menu/lunchCategoryCatalog";
import { isSanityDrivenCategory } from "@/lib/provider-menu/providerMenuTierContract";
import { catalogSupportsPersistentEdit } from "@/lib/provider-menu/providerMenuCatalogReadModel";
import type { EnterpriseUpgradeType } from "@/lib/providers/providerMenuPackageSurface";

export type VariantDisplayStatusKey =
  | "fixed_choice"
  | "published"
  | "draft"
  | "existing"
  | "missing_publish"
  | "missing_warm_dish";

/** @deprecated Use VariantDisplayStatusKey — kept as alias for internal comparisons. */
export type VariantDisplayStatus = VariantDisplayStatusKey;

export type EnterpriseSourceKey = "basedOnBasis" | "basedOnLuxus" | "ownEnterprise";

export type WorkspaceWeekSummaryKey = "missing" | "ready" | "published" | "has_draft";

export type ProviderVariantDisplayRow = {
  category: Category;
  variant: CatalogFixedVariant | null;
  title: string;
  status: VariantDisplayStatusKey;
  editable: boolean;
  sanityDriven: boolean;
  enterpriseSourceKey?: EnterpriseSourceKey | null;
  enterpriseUpgradeType?: EnterpriseUpgradeType | null;
  enterpriseUpgradeNote?: string | null;
  enterpriseWeakValue?: boolean;
};

export function providerWorkspaceCategories(
  catalog: ProviderMenuCatalogSnapshot,
  tier: PlanTier,
): Category[] {
  return workspaceCategoriesFromCatalog(catalog, tier);
}

function enterpriseSourceKey(sourcePackage: PlanTier | null | undefined): EnterpriseSourceKey | null {
  if (sourcePackage === "BASIS") return "basedOnBasis";
  if (sourcePackage === "LUXUS") return "basedOnLuxus";
  if (sourcePackage === "ENTERPRISE") return "ownEnterprise";
  return null;
}

function enterpriseWeakValue(
  tier: PlanTier,
  menuSlot: ResolvedProviderMenuSlot,
  hasUpgrade: boolean,
): boolean {
  if (tier !== "ENTERPRISE") return false;
  if (!menuSlotHasContent(menuSlot)) return false;
  return !hasUpgrade;
}

export function resolveVariantRowsForDay(
  slots: Record<string, ResolvedProviderMenuSlot>,
  date: string,
  tier: PlanTier,
  category: Category,
  catalog: ProviderMenuCatalogSnapshot,
): ProviderVariantDisplayRow[] {
  const menuSlot = resolveProviderMenuSlot(slots, date, tier, category);
  const sanityDriven = isSanityDrivenCategory(category);
  const hasUpgrade = Boolean(menuSlot.upgradeType) || String(menuSlot.upgradeNote ?? "").trim().length >= 8;
  const enterpriseMeta =
    tier === "ENTERPRISE"
      ? {
          enterpriseSourceKey: enterpriseSourceKey(menuSlot.sourcePackage),
          enterpriseUpgradeType: menuSlot.upgradeType,
          enterpriseUpgradeNote: menuSlot.upgradeNote?.trim() || null,
          enterpriseWeakValue: enterpriseWeakValue(tier, menuSlot, hasUpgrade),
        }
      : {};

  if (sanityDriven) {
    const hasContent = menuSlotHasContent(menuSlot);
    let status: VariantDisplayStatusKey = "missing_warm_dish";
    if (menuSlot.status === "published") status = "published";
    else if (menuSlot.status === "draft" && hasContent) status = "draft";
    else if (hasContent) status = "existing";

    return [
      {
        category,
        variant: null,
        title: hasContent ? menuSlot.mealTitle.trim() : categoryLabelFromCatalog(catalog, category),
        status,
        editable: true,
        sanityDriven: true,
        ...enterpriseMeta,
      },
    ];
  }

  const variants = fixedVariantsFromCatalog(catalog, tier, category);
  const categoryPublished = menuSlot.status === "published";
  const categoryDraft = menuSlot.status === "draft" && menuSlotHasContent(menuSlot);

  return variants.map((variant) => {
    let status: VariantDisplayStatusKey = "fixed_choice";
    if (categoryPublished) status = "published";
    else if (categoryDraft) status = "draft";
    else if (menuSlotHasContent(menuSlot)) status = "existing";

    return {
      category,
      variant,
      title: variant.title,
      status,
      editable: catalogSupportsPersistentEdit(),
      sanityDriven: false,
      ...enterpriseMeta,
    };
  });
}

export function summarizeWorkspaceWeekStatusKey(
  slots: Record<string, ResolvedProviderMenuSlot>,
  dates: string[],
  tier: PlanTier,
  catalog: ProviderMenuCatalogSnapshot,
): WorkspaceWeekSummaryKey {
  const categories = providerWorkspaceCategories(catalog, tier);
  let filled = 0;
  let total = 0;
  let published = 0;

  for (const date of dates) {
    for (const category of categories) {
      const rows = resolveVariantRowsForDay(slots, date, tier, category, catalog);
      for (const row of rows) {
        total += 1;
        if (row.status !== "missing_warm_dish" && row.status !== "missing_publish") {
          filled += 1;
        }
        if (row.status === "published") published += 1;
      }
    }
  }

  if (filled === 0) return "missing";
  if (published === total && total > 0) return "ready";
  if (published > 0) return "published";
  return "has_draft";
}

/** @deprecated Use summarizeWorkspaceWeekStatusKey — returns i18n key id only. */
export function summarizeWorkspaceWeekStatus(
  slots: Record<string, ResolvedProviderMenuSlot>,
  dates: string[],
  tier: PlanTier,
  catalog: ProviderMenuCatalogSnapshot,
): WorkspaceWeekSummaryKey {
  return summarizeWorkspaceWeekStatusKey(slots, dates, tier, catalog);
}
