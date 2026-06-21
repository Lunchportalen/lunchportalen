// lib/provider-menu/mergeProviderMenuSlots.ts
// Non-destructive slot merge: published > draft > legacy/source > empty.

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import {
  canonicalMenuCategory,
  menuSlotHasContent,
} from "@/lib/provider-menu/menuCategoryCanonical";
import type { ProviderMenuDayRow } from "@/lib/provider-menu/loadProviderMenuDays";
import {
  slotKey,
  type ProviderMenuSlotState,
} from "@/lib/providers/providerMenuPackageSurface";

export type SlotContentSource = "published" | "draft" | "legacy" | "empty";

export type ResolvedProviderMenuSlot = ProviderMenuSlotState & {
  contentSource: SlotContentSource;
  providerOverride?: boolean;
  autoFilled?: boolean;
  hasGeneratedBaseline?: boolean;
  orderLocked?: boolean;
};

function slotPriority(status: ProviderMenuSlotState["status"]): number {
  if (status === "published") return 3;
  if (status === "draft") return 2;
  return 0;
}

function rowToSlot(row: ProviderMenuDayRow, source: SlotContentSource): ResolvedProviderMenuSlot {
  return {
    date: row.date,
    tier: row.tier,
    category: row.category,
    mealTitle: row.mealTitle,
    description: row.description,
    allergensText: row.allergens.join(", "),
    estimatedCostPerPortion: row.estimatedCostPerPortion,
    sourcePackage: row.sourcePackage,
    upgradeType: (row.upgradeType as ProviderMenuSlotState["upgradeType"]) ?? null,
    upgradeNote: row.upgradeNote ?? "",
    status: row.status,
    docId: row.id,
    contentSource: source,
    providerOverride: Boolean(row.providerOverride),
    autoFilled: Boolean(row.autoFilled),
    hasGeneratedBaseline: Boolean(
      row.generatedBaseline?.mealTitle?.trim() || row.generatedBaseline?.description?.trim(),
    ),
    orderLocked: row.orderLocked === true,
  };
}

function emptyResolvedSlot(date: string, tier: PlanTier, category: Category): ResolvedProviderMenuSlot {
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

/**
 * Merges API rows into slot map with canonical category keys.
 * Higher-priority content wins; never replaces content with empty.
 */
export function mergeProviderMenuRowsIntoSlots(
  items: readonly ProviderMenuDayRow[],
): Record<string, ResolvedProviderMenuSlot> {
  const merged: Record<string, ResolvedProviderMenuSlot> = {};

  for (const row of items) {
    const category = canonicalMenuCategory(row.category);
    const tier = String(row.tier ?? "").trim().toUpperCase() as PlanTier;
    if (!category || !row.date) continue;

    const key = slotKey(row.date, tier, category);
    const source: SlotContentSource =
      row.status === "published" ? "published" : menuSlotHasContent(row) ? "draft" : "legacy";
    const incoming = rowToSlot({ ...row, category, tier }, source);

    if (!menuSlotHasContent(incoming) && incoming.status !== "published") continue;

    const existing = merged[key];
    if (!existing) {
      merged[key] = incoming;
      continue;
    }

    if (slotPriority(incoming.status) > slotPriority(existing.status)) {
      merged[key] = incoming;
      continue;
    }

    if (slotPriority(incoming.status) === slotPriority(existing.status) && menuSlotHasContent(incoming)) {
      merged[key] = incoming;
    }
  }

  return merged;
}

export function resolveProviderMenuSlot(
  slots: Record<string, ResolvedProviderMenuSlot>,
  date: string,
  tier: PlanTier,
  category: Category,
): ResolvedProviderMenuSlot {
  return slots[slotKey(date, tier, category)] ?? emptyResolvedSlot(date, tier, category);
}

export function slotDisplayStatus(slot: ResolvedProviderMenuSlot): string {
  if (slot.status === "published") return "Publisert";
  if (slot.status === "draft") return "Utkast";
  if (slot.contentSource === "legacy") return "Eksisterende";
  if (menuSlotHasContent(slot)) return "Utkast";
  return "Tom";
}

export function slotDisplayTitle(slot: ResolvedProviderMenuSlot): string {
  if (menuSlotHasContent(slot)) return slot.mealTitle.trim();
  return "—";
}
