// lib/provider-menu/providerMenuWorkspace.ts
// Workspace helpers: status chips, editor context, category summaries.

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import { CATEGORY_LABELS } from "@/lib/cms/menuDayContract";
import { menuSlotHasContent } from "@/lib/provider-menu/menuCategoryCanonical";
import type { ResolvedProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";
import { resolveProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";
import {
  isSanityDrivenCategory,
  contractForCategory,
} from "@/lib/provider-menu/providerMenuTierContract";
import {
  resolveVariantRowsForDay,
  type ProviderVariantDisplayRow,
  type VariantDisplayStatus,
} from "@/lib/provider-menu/providerMenuCatalogSurface";

export type WorkspaceStatusChip = "published" | "draft" | "fixed" | "missing" | "suggestion";

export type CategoryDaySummary = {
  category: Category;
  categoryLabel: string;
  statusChip: WorkspaceStatusChip;
  statusLabel: string;
  rows: ProviderVariantDisplayRow[];
  isSanityDriven: boolean;
  slot: ResolvedProviderMenuSlot;
};

export function statusChipFromRowStatus(status: VariantDisplayStatus): WorkspaceStatusChip {
  if (status === "Publisert") return "published";
  if (status === "Utkast" || status === "Eksisterende") return "draft";
  if (status === "Fast valg") return "fixed";
  if (status === "Mangler varmmat fra Sanity/bank" || status === "Mangler publisering") return "missing";
  return "suggestion";
}

export function statusChipLabel(chip: WorkspaceStatusChip): string {
  switch (chip) {
    case "published":
      return "Publisert";
    case "draft":
      return "Utkast";
    case "fixed":
      return "Fast valg";
    case "missing":
      return "Mangler";
    case "suggestion":
      return "Forslag";
  }
}

export function summarizeCategoryDay(
  slots: Record<string, ResolvedProviderMenuSlot>,
  date: string,
  tier: PlanTier,
  category: Category,
): CategoryDaySummary {
  const rows = resolveVariantRowsForDay(slots, date, tier, category);
  const slot = resolveProviderMenuSlot(slots, date, tier, category);
  const contract = contractForCategory(category);

  let statusChip: WorkspaceStatusChip = "fixed";
  if (slot.status === "published" || rows.some((r) => r.status === "Publisert")) {
    statusChip = "published";
  } else if (
    (slot.status === "draft" && menuSlotHasContent(slot)) ||
    rows.some((r) => r.status === "Utkast" || r.status === "Eksisterende")
  ) {
    statusChip = "draft";
  } else if (rows.some((r) => r.status === "Mangler varmmat fra Sanity/bank")) {
    statusChip = "missing";
  } else if (isSanityDrivenCategory(category) && !menuSlotHasContent(slot)) {
    statusChip = "missing";
  }

  return {
    category,
    categoryLabel: contract?.categoryLabel ?? CATEGORY_LABELS[category],
    statusChip,
    statusLabel: statusChipLabel(statusChip),
    rows,
    isSanityDriven: isSanityDrivenCategory(category),
    slot,
  };
}

export type EditorContext = {
  tierLabel: string;
  weekdayLabel: string;
  date: string;
  categoryLabel: string;
  variantLabel: string | null;
  mode: "catalog" | "varmrett" | "enterprise";
};

export function buildEditorContext(input: {
  tier: PlanTier;
  tierLabel: string;
  weekdayLabel: string;
  date: string;
  category: Category;
  variantLabel?: string | null;
}): EditorContext {
  const contract = contractForCategory(input.category);
  const isSanity = isSanityDrivenCategory(input.category);
  let mode: EditorContext["mode"] = "catalog";
  if (input.tier === "ENTERPRISE") mode = "enterprise";
  else if (isSanity) mode = "varmrett";

  return {
    tierLabel: input.tierLabel,
    weekdayLabel: input.weekdayLabel,
    date: input.date,
    categoryLabel: contract?.categoryLabel ?? CATEGORY_LABELS[input.category],
    variantLabel: input.variantLabel ?? null,
    mode,
  };
}

export function editorContextLine(ctx: EditorContext): string {
  const parts = [ctx.tierLabel];
  if (ctx.weekdayLabel) parts.push(ctx.weekdayLabel);
  parts.push(ctx.categoryLabel);
  if (ctx.variantLabel) parts.push(ctx.variantLabel);
  return parts.join(" · ");
}
