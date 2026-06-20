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
import { ENTERPRISE_UPGRADE_LABELS } from "@/lib/providers/providerMenuPackageSurface";

export type VariantDisplayStatus =
  | "Fast valg"
  | "Publisert"
  | "Utkast"
  | "Eksisterende"
  | "Mangler publisering"
  | "Mangler varmmat fra Sanity/bank";

export type ProviderVariantDisplayRow = {
  category: Category;
  variant: CatalogFixedVariant | null;
  title: string;
  status: VariantDisplayStatus;
  editable: boolean;
  sanityDriven: boolean;
  enterpriseSourceLabel?: string | null;
  enterpriseUpgradeLabel?: string | null;
  enterpriseUpgradeNote?: string | null;
  enterpriseWeakValue?: boolean;
};

export function providerWorkspaceCategories(
  catalog: ProviderMenuCatalogSnapshot,
  tier: PlanTier,
): Category[] {
  return workspaceCategoriesFromCatalog(catalog, tier);
}

function enterpriseSourceLabel(sourcePackage: PlanTier | null | undefined): string | null {
  if (sourcePackage === "BASIS") return "Basert på Basis";
  if (sourcePackage === "LUXUS") return "Basert på Luxus";
  if (sourcePackage === "ENTERPRISE") return "Egen Enterprise";
  return null;
}

function enterpriseUpgradeLabel(upgradeType: EnterpriseUpgradeType | null | undefined): string | null {
  if (!upgradeType) return null;
  return ENTERPRISE_UPGRADE_LABELS[upgradeType] ?? upgradeType;
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
          enterpriseSourceLabel: enterpriseSourceLabel(menuSlot.sourcePackage),
          enterpriseUpgradeLabel: enterpriseUpgradeLabel(menuSlot.upgradeType),
          enterpriseUpgradeNote: menuSlot.upgradeNote?.trim() || null,
          enterpriseWeakValue: enterpriseWeakValue(tier, menuSlot, hasUpgrade),
        }
      : {};

  if (sanityDriven) {
    const hasContent = menuSlotHasContent(menuSlot);
    let status: VariantDisplayStatus = "Mangler varmmat fra Sanity/bank";
    if (menuSlot.status === "published") status = "Publisert";
    else if (menuSlot.status === "draft" && hasContent) status = "Utkast";
    else if (hasContent) status = "Eksisterende";

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
    let status: VariantDisplayStatus = "Fast valg";
    if (categoryPublished) status = "Publisert";
    else if (categoryDraft) status = "Utkast";
    else if (menuSlotHasContent(menuSlot)) status = "Eksisterende";

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

export function summarizeWorkspaceWeekStatus(
  slots: Record<string, ResolvedProviderMenuSlot>,
  dates: string[],
  tier: PlanTier,
  catalog: ProviderMenuCatalogSnapshot,
): string {
  const categories = providerWorkspaceCategories(catalog, tier);
  let filled = 0;
  let total = 0;
  let published = 0;

  for (const date of dates) {
    for (const category of categories) {
      const rows = resolveVariantRowsForDay(slots, date, tier, category, catalog);
      for (const row of rows) {
        total += 1;
        if (row.status !== "Mangler varmmat fra Sanity/bank" && row.status !== "Mangler publisering") {
          filled += 1;
        }
        if (row.status === "Publisert") published += 1;
      }
    }
  }

  if (filled === 0) return "Mangler dager";
  if (published === total && total > 0) return "Klar til publisering";
  if (published > 0) return "Publisert";
  return "Har utkast";
}
