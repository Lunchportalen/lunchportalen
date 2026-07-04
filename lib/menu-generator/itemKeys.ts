import type { FixedCategoryKey, MenuLocale } from "@/lib/menu-generator/types";
import type { PlanTier } from "@/lib/cms/menuDayContract";

export function buildStableItemKey(
  menuLocale: MenuLocale,
  categoryKey: FixedCategoryKey,
  slug: string,
): string {
  return `${menuLocale}:${categoryKey}:${slug}`;
}

export function buildStableChoiceKey(input: {
  providerId: string;
  weekStart: string;
  dayIndex: number;
  tier: PlanTier;
  itemKey: string;
}): string {
  return [
    String(input.providerId ?? "").trim(),
    String(input.weekStart ?? "").trim(),
    String(input.dayIndex),
    input.tier,
    input.itemKey,
  ].join(":");
}
