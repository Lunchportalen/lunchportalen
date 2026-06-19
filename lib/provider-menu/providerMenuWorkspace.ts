// lib/provider-menu/providerMenuWorkspace.ts
// Workspace helpers: status chips, editor context, category summaries.

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import { CATEGORY_LABELS, PLAN_TIERS } from "@/lib/cms/menuDayContract";
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

export type EditorFocus = "varmrett" | "enterprise-upgrade" | "category";

export const ENTERPRISE_UPGRADE_SELECTION_KEY = "enterprise-upgrade";

export type EditorContext = {
  tierLabel: string;
  weekdayLabel: string;
  date: string;
  categoryLabel: string;
  variantLabel: string | null;
  editorFocus: EditorFocus;
  mode: "catalog" | "varmrett" | "enterprise";
};

export function buildEditorContext(input: {
  tier: PlanTier;
  tierLabel: string;
  weekdayLabel: string;
  date: string;
  category: Category;
  variantLabel?: string | null;
  editorFocus?: EditorFocus;
}): EditorContext {
  const contract = contractForCategory(input.category);
  const isSanity = isSanityDrivenCategory(input.category);
  const editorFocus: EditorFocus =
    input.editorFocus ?? (isSanity ? "varmrett" : "category");

  let mode: EditorContext["mode"] = "catalog";
  if (editorFocus === "enterprise-upgrade") mode = "enterprise";
  else if (editorFocus === "varmrett" || isSanity) mode = "varmrett";

  return {
    tierLabel: input.tierLabel,
    weekdayLabel: input.weekdayLabel,
    date: input.date,
    categoryLabel: contract?.categoryLabel ?? CATEGORY_LABELS[input.category],
    variantLabel: input.variantLabel ?? null,
    editorFocus,
    mode,
  };
}

export function editorContextLine(ctx: EditorContext): string {
  if (ctx.editorFocus === "varmrett") {
    return `${ctx.weekdayLabel} · felles for alle pakker`;
  }
  if (ctx.editorFocus === "enterprise-upgrade") {
    return `${ctx.weekdayLabel} · tillegg til dagens varmmrett`;
  }
  const parts = [ctx.tierLabel];
  if (ctx.weekdayLabel) parts.push(ctx.weekdayLabel);
  parts.push(ctx.categoryLabel);
  if (ctx.variantLabel) parts.push(ctx.variantLabel);
  return parts.join(" · ");
}

/** One warm dish per delivery day — shared across all packages. */
export const SHARED_WARM_DISH_HINT = "Samme for alle pakker";

export const PACKAGE_WARM_DISH_HELPER =
  "Varmretten er felles per dag. Pakken styrer faste valg og eventuelle upgrades.";

export const DAY_PACKAGE_INCLUDES = {
  basis: "Basis: Påsmurt · Salatboks",
  luxus: "Luxus: + Sushi · Poké · Thai",
  enterprise: "Enterprise: + Upgrade",
} as const;

/** Package card copy for command header — contract-aligned, not invented. */
export const PACKAGE_CARD_COPY: Record<
  PlanTier,
  { title: string; includes: string; priceHint: string }
> = {
  BASIS: {
    title: "Basis",
    includes: "Påsmurt · Salatboks · Dagens varmmrett",
    priceHint: "90 kr eks. mva",
  },
  LUXUS: {
    title: "Luxus",
    includes: "Basis + Sushi · Poké · Thai",
    priceHint: "130 kr eks. mva",
  },
  ENTERPRISE: {
    title: "Enterprise",
    includes: "Luxus + Enterprise-upgrade",
    priceHint: "170 kr eks. mva",
  },
};

const VARMRETT_TIER_PRIORITY: Record<PlanTier, number> = {
  BASIS: 3,
  LUXUS: 2,
  ENTERPRISE: 1,
};

function varmrettSlotScore(slot: ResolvedProviderMenuSlot): number {
  if (slot.status === "published") return 30;
  if (slot.status === "draft" && menuSlotHasContent(slot)) return 20;
  if (menuSlotHasContent(slot)) return 10;
  return 0;
}

/** Display/read-model: one shared warm dish per day (storage may still be per-tier). */
export function resolveSharedVarmrettSlot(
  slots: Record<string, ResolvedProviderMenuSlot>,
  date: string,
): ResolvedProviderMenuSlot {
  let best = resolveProviderMenuSlot(slots, date, "BASIS", "varmrett");
  let bestScore = varmrettSlotScore(best) + VARMRETT_TIER_PRIORITY.BASIS;

  for (const tier of PLAN_TIERS) {
    const slot = resolveProviderMenuSlot(slots, date, tier, "varmrett");
    const score = varmrettSlotScore(slot) + VARMRETT_TIER_PRIORITY[tier];
    if (score > bestScore) {
      best = slot;
      bestScore = score;
    }
  }

  return best;
}

export function summarizeSharedVarmrettDay(
  slots: Record<string, ResolvedProviderMenuSlot>,
  date: string,
): CategoryDaySummary {
  const slot = resolveSharedVarmrettSlot(slots, date);
  const contract = contractForCategory("varmrett");
  const hasContent = menuSlotHasContent(slot);

  let statusChip: WorkspaceStatusChip = "missing";
  if (slot.status === "published") statusChip = "published";
  else if (slot.status === "draft" && hasContent) statusChip = "draft";
  else if (hasContent) statusChip = "draft";
  else statusChip = "missing";

  return {
    category: "varmrett",
    categoryLabel: contract?.categoryLabel ?? CATEGORY_LABELS.varmrett,
    statusChip,
    statusLabel: statusChipLabel(statusChip),
    rows: [
      {
        category: "varmrett",
        variant: null,
        title: hasContent ? slot.mealTitle.trim() : "Varmrett",
        status:
          slot.status === "published"
            ? "Publisert"
            : hasContent
              ? "Utkast"
              : "Mangler varmmat fra Sanity/bank",
        editable: true,
        sanityDriven: true,
      },
    ],
    isSanityDriven: true,
    slot,
  };
}

export type EnterpriseUpgradeDaySummary = {
  statusChip: WorkspaceStatusChip;
  statusLabel: string;
  summaryLine: string;
  slot: ResolvedProviderMenuSlot;
};

export function summarizeEnterpriseUpgradeDay(
  slots: Record<string, ResolvedProviderMenuSlot>,
  date: string,
): EnterpriseUpgradeDaySummary {
  const slot = resolveProviderMenuSlot(slots, date, "ENTERPRISE", "varmrett");
  const hasUpgrade =
    Boolean(slot.upgradeType) || String(slot.upgradeNote ?? "").trim().length >= 8;

  let statusChip: WorkspaceStatusChip = "missing";
  if (slot.status === "published" && hasUpgrade) statusChip = "published";
  else if (slot.status === "draft" && hasUpgrade) statusChip = "draft";
  else if (hasUpgrade) statusChip = "draft";

  const summaryLine = hasUpgrade
    ? slot.upgradeNote?.trim() || "Upgrade planlagt"
    : "Upgrade mangler";

  return {
    statusChip,
    statusLabel: statusChipLabel(statusChip),
    summaryLine,
    slot,
  };
}

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
    const sharedVarmrett = summarizeSharedVarmrettDay(slots, date);
    if (sharedVarmrett.statusChip === "missing") varmrettMissing += 1;
    else varmrettFilled += 1;

    for (const category of categories) {
      if (category === "varmrett") continue;
      const summary = summarizeCategoryDay(slots, date, tier, category);
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
  enterpriseUpgrade: EnterpriseUpgradeDaySummary | null;
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
  const summaries = categories
    .filter((c) => c !== "varmrett")
    .map((c) => summarizeCategoryDay(slots, date, tier, c));
  const varmrett = summarizeSharedVarmrettDay(slots, date);
  const enterpriseUpgrade = tier === "ENTERPRISE" ? summarizeEnterpriseUpgradeDay(slots, date) : null;

  let dayStatus: WorkspaceStatusChip = "fixed";
  const statusSources: WorkspaceStatusChip[] = [
    varmrett.statusChip,
    ...summaries.map((s) => s.statusChip),
  ];
  if (enterpriseUpgrade) statusSources.push(enterpriseUpgrade.statusChip);

  if (statusSources.some((s) => s === "missing")) dayStatus = "missing";
  else if (statusSources.some((s) => s === "draft")) dayStatus = "draft";
  else if (statusSources.every((s) => s === "published" || s === "fixed")) {
    dayStatus = statusSources.some((s) => s === "published") ? "published" : "fixed";
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
    enterpriseUpgrade,
    fixedGroups,
    premiumGroups,
  };
}
