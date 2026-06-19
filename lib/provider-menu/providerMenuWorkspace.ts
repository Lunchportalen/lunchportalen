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

/** Package card copy for command header — contract-aligned, not invented. */
export const PACKAGE_CARD_COPY: Record<
  PlanTier,
  { title: string; includes: string; priceHint: string }
> = {
  BASIS: {
    title: "Basis",
    includes: "Påsmurt · Salatboks · Varmrett",
    priceHint: "90 eks. mva",
  },
  LUXUS: {
    title: "Luxus",
    includes: "Basis + Sushi · Poké · Thai",
    priceHint: "130 eks. mva",
  },
  ENTERPRISE: {
    title: "Enterprise",
    includes: "Luxus + premium upgrade",
    priceHint: "170 eks. mva",
  },
};

const PREMIUM_CATEGORIES: Category[] = ["sushi", "pokebowl", "thai"];
const FIXED_CATEGORIES: Category[] = ["paasmurt", "salat"];

export type WeekWorkspaceMetrics = {
  daysPlanned: number;
  varmrettFilled: number;
  varmrettMissing: number;
  publishedSlots: number;
  draftSlots: number;
  fixedSlots: number;
};

export function summarizeWeekMetrics(
  slots: Record<string, ResolvedProviderMenuSlot>,
  dates: string[],
  tier: PlanTier,
  categories: Category[],
): WeekWorkspaceMetrics {
  let varmrettFilled = 0;
  let varmrettMissing = 0;
  let publishedSlots = 0;
  let draftSlots = 0;
  let fixedSlots = 0;

  for (const date of dates) {
    for (const category of categories) {
      const summary = summarizeCategoryDay(slots, date, tier, category);
      if (summary.isSanityDriven) {
        if (summary.statusChip === "missing") varmrettMissing += 1;
        else varmrettFilled += 1;
      }
      if (summary.statusChip === "published") publishedSlots += 1;
      else if (summary.statusChip === "draft") draftSlots += 1;
      else if (summary.statusChip === "fixed") fixedSlots += 1;
    }
  }

  return {
    daysPlanned: dates.length,
    varmrettFilled,
    varmrettMissing,
    publishedSlots,
    draftSlots,
    fixedSlots,
  };
}

export type CategoryGroupRow = {
  category: Category;
  categoryLabel: string;
  variantCount: number;
  summaryLine: string;
  statusChip: WorkspaceStatusChip;
  statusLabel: string;
  isPremium: boolean;
};

export type DayCardSummary = {
  date: string;
  weekdayLabel: string;
  dayStatus: WorkspaceStatusChip;
  dayStatusLabel: string;
  varmrett: CategoryDaySummary;
  fixedGroups: CategoryGroupRow[];
  premiumGroups: CategoryGroupRow[];
};

function categorySummaryLine(summary: CategoryDaySummary): string {
  const count = summary.rows.length;
  if (summary.category === "sushi") return "fast pakke";
  if (count <= 1) return summary.rows[0]?.title ?? "1 valg";
  const first = summary.rows[0]?.title ?? "";
  return `${first} +${count - 1}`;
}

export function summarizeDayCard(
  slots: Record<string, ResolvedProviderMenuSlot>,
  date: string,
  tier: PlanTier,
  weekdayLabel: string,
  categories: Category[],
): DayCardSummary {
  const summaries = categories.map((c) => summarizeCategoryDay(slots, date, tier, c));
  const varmrett = summaries.find((s) => s.isSanityDriven)!;

  let dayStatus: WorkspaceStatusChip = "fixed";
  if (summaries.some((s) => s.statusChip === "missing")) dayStatus = "missing";
  else if (summaries.some((s) => s.statusChip === "draft")) dayStatus = "draft";
  else if (summaries.every((s) => s.statusChip === "published" || s.statusChip === "fixed")) {
    dayStatus = summaries.some((s) => s.statusChip === "published") ? "published" : "fixed";
  }

  const toGroup = (s: CategoryDaySummary): CategoryGroupRow => ({
    category: s.category,
    categoryLabel: s.categoryLabel,
    variantCount: s.rows.length,
    summaryLine: categorySummaryLine(s),
    statusChip: s.statusChip,
    statusLabel: s.statusLabel,
    isPremium: PREMIUM_CATEGORIES.includes(s.category),
  });

  const fixedGroups = summaries
    .filter((s) => !s.isSanityDriven && FIXED_CATEGORIES.includes(s.category))
    .map(toGroup);
  const premiumGroups = summaries
    .filter((s) => !s.isSanityDriven && PREMIUM_CATEGORIES.includes(s.category))
    .map(toGroup);

  return {
    date,
    weekdayLabel,
    dayStatus,
    dayStatusLabel: statusChipLabel(dayStatus),
    varmrett,
    fixedGroups,
    premiumGroups,
  };
}
