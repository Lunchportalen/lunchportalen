// lib/provider-menu/providerMenuCatalogSurface.ts
// Provider menu builder display: fixed catalog + published menuDay overlay.

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import {
  fixedVariantsForCategory,
  isSanityDrivenCategory,
  workspaceCategoriesForTier,
  type FixedMenuVariant,
} from "@/lib/provider-menu/basisMenuContract";
import { menuSlotHasContent } from "@/lib/provider-menu/menuCategoryCanonical";
import type { ResolvedProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";
import { resolveProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";

export type VariantDisplayStatus =
  | "Fast valg"
  | "Publisert"
  | "Utkast"
  | "Eksisterende"
  | "Mangler publisering"
  | "Mangler varmmat fra Sanity";

export type ProviderVariantDisplayRow = {
  category: Category;
  variant: FixedMenuVariant | null;
  title: string;
  status: VariantDisplayStatus;
  editable: boolean;
  sanityDriven: boolean;
};

export function providerWorkspaceCategories(tier: PlanTier): Category[] {
  return workspaceCategoriesForTier(tier);
}

export function resolveVariantRowsForDay(
  slots: Record<string, ResolvedProviderMenuSlot>,
  date: string,
  tier: PlanTier,
  category: Category,
): ProviderVariantDisplayRow[] {
  const menuSlot = resolveProviderMenuSlot(slots, date, tier, category);
  const sanityDriven = isSanityDrivenCategory(category);

  if (sanityDriven) {
    const hasContent = menuSlotHasContent(menuSlot);
    let status: VariantDisplayStatus = "Mangler varmmat fra Sanity";
    if (menuSlot.status === "published") status = "Publisert";
    else if (menuSlot.status === "draft" && hasContent) status = "Utkast";
    else if (hasContent) status = "Eksisterende";

    return [
      {
        category,
        variant: null,
        title: hasContent ? menuSlot.mealTitle.trim() : "Varmmat",
        status,
        editable: true,
        sanityDriven: true,
      },
    ];
  }

  const variants = fixedVariantsForCategory(category);
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
      editable: false,
      sanityDriven: false,
    };
  });
}

export function summarizeWorkspaceWeekStatus(
  slots: Record<string, ResolvedProviderMenuSlot>,
  dates: string[],
  tier: PlanTier,
): string {
  const categories = providerWorkspaceCategories(tier);
  let filled = 0;
  let total = 0;
  let published = 0;

  for (const date of dates) {
    for (const category of categories) {
      const rows = resolveVariantRowsForDay(slots, date, tier, category);
      for (const row of rows) {
        total += 1;
        if (row.status !== "Mangler varmmat fra Sanity" && row.status !== "Mangler publisering") {
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
