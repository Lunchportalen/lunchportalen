// lib/provider-menu/providerMenuWorkspace.ts
// Workspace helpers: status chips, editor context, category summaries.

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import { CATEGORY_LABELS, PLAN_TIERS } from "@/lib/cms/menuDayContract";
import { menuSlotHasContent } from "@/lib/provider-menu/menuCategoryCanonical";
import type { ResolvedProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";
import { resolveProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";
import {
  categoryLabelFromCatalog,
  type ProviderMenuCatalogSnapshot,
} from "@/lib/provider-menu/lunchCategoryCatalog";
import {
  resolveVariantRowsForDay,
  type ProviderVariantDisplayRow,
  type VariantDisplayStatusKey,
} from "@/lib/provider-menu/providerMenuCatalogSurface";
import { isSanityDrivenCategory } from "@/lib/provider-menu/providerMenuTierContract";
import type { EnterpriseUpgradeType, WeekdayKey } from "@/lib/providers/providerMenuPackageSurface";

export type WorkspaceStatusChip = "published" | "draft" | "fixed" | "missing" | "suggestion";

export type CategoryDaySummary = {
  category: Category;
  categoryLabel: string;
  statusChip: WorkspaceStatusChip;
  statusLabelKey: WorkspaceStatusChip;
  rows: ProviderVariantDisplayRow[];
  isSanityDriven: boolean;
  slot: ResolvedProviderMenuSlot;
};

export function statusChipFromRowStatus(status: VariantDisplayStatusKey): WorkspaceStatusChip {
  if (status === "published") return "published";
  if (status === "draft" || status === "existing") return "draft";
  if (status === "fixed_choice") return "fixed";
  if (status === "missing_warm_dish" || status === "missing_publish") return "missing";
  return "suggestion";
}

export function statusChipLabelKey(chip: WorkspaceStatusChip): WorkspaceStatusChip {
  return chip;
}

/** @deprecated Use statusChipLabelKey — returns stable i18n key id (same as chip). */
export function statusChipLabel(chip: WorkspaceStatusChip): WorkspaceStatusChip {
  return statusChipLabelKey(chip);
}

export function summarizeCategoryDay(
  slots: Record<string, ResolvedProviderMenuSlot>,
  date: string,
  tier: PlanTier,
  category: Category,
  catalog: ProviderMenuCatalogSnapshot,
  profileCategoryLabels?: Partial<Record<Category, string>>,
): CategoryDaySummary {
  const rows = resolveVariantRowsForDay(slots, date, tier, category, catalog);
  const slot = resolveProviderMenuSlot(slots, date, tier, category);

  let statusChip: WorkspaceStatusChip = "fixed";
  if (slot.status === "published" || rows.some((r) => r.status === "published")) {
    statusChip = "published";
  } else if (
    (slot.status === "draft" && menuSlotHasContent(slot)) ||
    rows.some((r) => r.status === "draft" || r.status === "existing")
  ) {
    statusChip = "draft";
  } else if (rows.some((r) => r.status === "missing_warm_dish")) {
    statusChip = "missing";
  } else if (isSanityDrivenCategory(category) && !menuSlotHasContent(slot)) {
    statusChip = "missing";
  }

  return {
    category,
    categoryLabel: categoryLabelFromCatalog(catalog, category, profileCategoryLabels),
    statusChip,
    statusLabelKey: statusChipLabelKey(statusChip),
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
  weekdayKey: WeekdayKey | null;
  date: string;
  categoryLabel: string;
  variantLabel: string | null;
  editorFocus: EditorFocus;
  mode: "catalog" | "varmrett" | "enterprise";
};

export type EditorContextLineKey = "shared_warm_meal" | "enterprise_upgrade" | "category";

export type EditorContextLine =
  | { key: "shared_warm_meal"; weekday: string }
  | { key: "enterprise_upgrade"; weekday: string }
  | { key: "category"; parts: string[] };

export function buildEditorContext(input: {
  tier: PlanTier;
  tierLabel: string;
  weekdayLabel: string;
  weekdayKey?: WeekdayKey | null;
  date: string;
  category: Category;
  variantLabel?: string | null;
  editorFocus?: EditorFocus;
  catalog?: ProviderMenuCatalogSnapshot;
  profileCategoryLabels?: Partial<Record<Category, string>>;
}): EditorContext {
  const isSanity = isSanityDrivenCategory(input.category);
  const editorFocus: EditorFocus =
    input.editorFocus ?? (isSanity ? "varmrett" : "category");

  let mode: EditorContext["mode"] = "catalog";
  if (editorFocus === "enterprise-upgrade") mode = "enterprise";
  else if (editorFocus === "varmrett" || isSanity) mode = "varmrett";

  return {
    tierLabel: input.tierLabel,
    weekdayLabel: input.weekdayLabel,
    weekdayKey: input.weekdayKey ?? null,
    date: input.date,
    categoryLabel: input.catalog
      ? categoryLabelFromCatalog(input.catalog, input.category, input.profileCategoryLabels)
      : input.profileCategoryLabels?.[input.category] ?? CATEGORY_LABELS[input.category],
    variantLabel: input.variantLabel ?? null,
    editorFocus,
    mode,
  };
}

export function resolveEditorContextLine(ctx: EditorContext): EditorContextLine {
  if (ctx.editorFocus === "varmrett") {
    return { key: "shared_warm_meal", weekday: ctx.weekdayLabel };
  }
  if (ctx.editorFocus === "enterprise-upgrade") {
    return { key: "enterprise_upgrade", weekday: ctx.weekdayLabel };
  }
  const parts = [ctx.tierLabel];
  if (ctx.weekdayLabel) parts.push(ctx.weekdayLabel);
  parts.push(ctx.categoryLabel);
  if (ctx.variantLabel) parts.push(ctx.variantLabel);
  return { key: "category", parts };
}

/** @deprecated Use resolveEditorContextLine — kept for tests migrating to i18n keys. */
export function editorContextLine(ctx: EditorContext): string {
  const line = resolveEditorContextLine(ctx);
  if (line.key === "shared_warm_meal") return `${line.weekday} · felles for alle pakker`;
  if (line.key === "enterprise_upgrade") return `${line.weekday} · Enterprise-upgrade`;
  return line.parts.join(" · ");
}

export type PackageCardKey = {
  tier: PlanTier;
  includesKey: "basis" | "luxus" | "enterprise";
  badgeKey?: "notSeparateProduction";
};

export const PACKAGE_CARD_KEYS: Record<PlanTier, PackageCardKey> = {
  BASIS: { tier: "BASIS", includesKey: "basis" },
  LUXUS: { tier: "LUXUS", includesKey: "luxus" },
  ENTERPRISE: { tier: "ENTERPRISE", includesKey: "enterprise", badgeKey: "notSeparateProduction" },
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
  catalog: ProviderMenuCatalogSnapshot,
  profileCategoryLabels?: Partial<Record<Category, string>>,
): CategoryDaySummary {
  const slot = resolveSharedVarmrettSlot(slots, date);
  const hasContent = menuSlotHasContent(slot);

  let statusChip: WorkspaceStatusChip = "missing";
  if (slot.status === "published") statusChip = "published";
  else if (slot.status === "draft" && hasContent) statusChip = "draft";
  else if (hasContent) statusChip = "draft";
  else statusChip = "missing";

  return {
    category: "varmrett",
    categoryLabel: categoryLabelFromCatalog(catalog, "varmrett", profileCategoryLabels),
    statusChip,
    statusLabelKey: statusChipLabelKey(statusChip),
    rows: [
      {
        category: "varmrett",
        variant: null,
        title: hasContent ? slot.mealTitle.trim() : categoryLabelFromCatalog(catalog, "varmrett", profileCategoryLabels),
        status:
          slot.status === "published"
            ? "published"
            : hasContent
              ? "draft"
              : "missing_warm_dish",
        editable: true,
        sanityDriven: true,
      },
    ],
    isSanityDriven: true,
    slot,
  };
}

export type EnterpriseUpgradeSummaryKey = "upgrade_planned" | "upgrade_missing";

export type EnterpriseUpgradeDaySummary = {
  statusChip: WorkspaceStatusChip;
  statusLabelKey: WorkspaceStatusChip;
  summaryKey: EnterpriseUpgradeSummaryKey;
  summaryNote: string | null;
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

  return {
    statusChip,
    statusLabelKey: statusChipLabelKey(statusChip),
    summaryKey: hasUpgrade ? "upgrade_planned" : "upgrade_missing",
    summaryNote: hasUpgrade ? slot.upgradeNote?.trim() || null : null,
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
  catalog: ProviderMenuCatalogSnapshot,
  profileCategoryLabels?: Partial<Record<Category, string>>,
): WeekWorkspaceMetrics {
  let varmrettFilled = 0;
  let varmrettMissing = 0;
  let publishedSlots = 0;
  let draftSlots = 0;
  let fixedSlots = 0;

  for (const date of dates) {
    const sharedVarmrett = summarizeSharedVarmrettDay(slots, date, catalog, profileCategoryLabels);
    if (sharedVarmrett.statusChip === "missing") varmrettMissing += 1;
    else varmrettFilled += 1;

    for (const category of categories) {
      if (category === "varmrett") continue;
      const summary = summarizeCategoryDay(slots, date, tier, category, catalog, profileCategoryLabels);
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

export type WeekReadinessKey = "not_ready" | "has_draft" | "ready_for_orders" | "ready_to_publish";

export function weekReadinessKey(metrics: WeekWorkspaceMetrics): WeekReadinessKey {
  if (metrics.varmrettMissing > 0) return "not_ready";
  if (metrics.draftSlots > 0) return "has_draft";
  if (metrics.publishedSlots > 0) return "ready_for_orders";
  return "ready_to_publish";
}

/** @deprecated Use weekReadinessKey */
export function weekReadinessLabel(metrics: WeekWorkspaceMetrics): WeekReadinessKey {
  return weekReadinessKey(metrics);
}

export type WeekCockpitPart =
  | { key: "week_from"; weekStart: string }
  | { key: "days"; count: number }
  | { key: "warm_dishes_missing"; count: number }
  | { key: "warm_dishes_filled"; count: number }
  | { key: "published_slots"; count: number }
  | { key: "draft_slots"; count: number }
  | { key: "readiness"; readiness: WeekReadinessKey };

export function buildWeekCockpitParts(weekStart: string, metrics: WeekWorkspaceMetrics): WeekCockpitPart[] {
  const parts: WeekCockpitPart[] = [
    { key: "week_from", weekStart },
    { key: "days", count: metrics.daysPlanned },
    metrics.varmrettMissing > 0
      ? { key: "warm_dishes_missing", count: metrics.varmrettMissing }
      : { key: "warm_dishes_filled", count: metrics.varmrettFilled },
  ];
  if (metrics.publishedSlots > 0) parts.push({ key: "published_slots", count: metrics.publishedSlots });
  if (metrics.draftSlots > 0) parts.push({ key: "draft_slots", count: metrics.draftSlots });
  parts.push({ key: "readiness", readiness: weekReadinessKey(metrics) });
  return parts;
}

/** @deprecated Use buildWeekCockpitParts — Norwegian string assembly for legacy tests only. */
export function buildWeekCockpitSummary(weekStart: string, metrics: WeekWorkspaceMetrics): string {
  const readiness = weekReadinessKey(metrics);
  const readinessLabels: Record<WeekReadinessKey, string> = {
    not_ready: "Ikke klar for publisering",
    has_draft: "Har utkast",
    ready_for_orders: "Klar for bestilling",
    ready_to_publish: "Klar for publisering",
  };
  const parts = [
    `Uke fra ${weekStart}`,
    `${metrics.daysPlanned} dager`,
    metrics.varmrettMissing > 0
      ? `${metrics.varmrettMissing} varmretter mangler`
      : `${metrics.varmrettFilled} varmretter`,
  ];
  if (metrics.publishedSlots > 0) parts.push(`${metrics.publishedSlots} publisert`);
  if (metrics.draftSlots > 0) parts.push(`${metrics.draftSlots} utkast`);
  parts.push(readinessLabels[readiness]);
  return parts.join(" · ");
}

export type NextStepActionKey =
  | "fill_warm_dish_for_day"
  | "fill_missing_warm_dishes"
  | "check_enterprise_upgrade"
  | "publish_week"
  | "ready_for_orders"
  | "preview_week";

export type NextStepAction =
  | { key: "fill_warm_dish_for_day"; weekdayKey: WeekdayKey }
  | { key: Exclude<NextStepActionKey, "fill_warm_dish_for_day"> };

export function resolveNextStepAction(
  slots: Record<string, ResolvedProviderMenuSlot>,
  dates: string[],
  tier: PlanTier,
  metrics: WeekWorkspaceMetrics,
  weekdayKeys: WeekdayKey[],
  catalog: ProviderMenuCatalogSnapshot,
): NextStepAction {
  if (metrics.varmrettMissing > 0) {
    for (let i = 0; i < dates.length; i++) {
      const shared = summarizeSharedVarmrettDay(slots, dates[i]!, catalog);
      if (shared.statusChip === "missing") {
        const weekdayKey = weekdayKeys[i] ?? "mon";
        return { key: "fill_warm_dish_for_day", weekdayKey };
      }
    }
    return { key: "fill_missing_warm_dishes" };
  }

  if (tier === "ENTERPRISE") {
    let upgradeMissing = 0;
    for (const date of dates) {
      const upgrade = summarizeEnterpriseUpgradeDay(slots, date);
      if (upgrade.statusChip === "missing") upgradeMissing += 1;
    }
    if (upgradeMissing > 0) return { key: "check_enterprise_upgrade" };
  }

  if (metrics.draftSlots > 0) return { key: "publish_week" };
  if (metrics.publishedSlots > 0) return { key: "ready_for_orders" };
  return { key: "preview_week" };
}

export type CategoryGroupRow = {
  category: Category;
  categoryLabel: string;
  variantCount: number;
  summaryLine: string;
  statusChip: WorkspaceStatusChip;
  statusLabelKey: WorkspaceStatusChip;
  isPremium: boolean;
};

export type DayCardSummary = {
  date: string;
  weekdayLabel: string;
  dayStatus: WorkspaceStatusChip;
  dayStatusLabelKey: WorkspaceStatusChip;
  varmrett: CategoryDaySummary;
  enterpriseUpgrade: EnterpriseUpgradeDaySummary | null;
  fixedGroups: CategoryGroupRow[];
  premiumGroups: CategoryGroupRow[];
};

function categorySummaryLine(summary: CategoryDaySummary): string {
  const count = summary.rows.length;
  if (summary.category === "sushi") return "fixed_package";
  if (count <= 1) return summary.rows[0]?.title ?? "one_choice";
  const first = summary.rows[0]?.title ?? "";
  return `${first} +${count - 1}`;
}

export function summarizeDayCard(
  slots: Record<string, ResolvedProviderMenuSlot>,
  date: string,
  tier: PlanTier,
  weekdayLabel: string,
  categories: Category[],
  catalog: ProviderMenuCatalogSnapshot,
): DayCardSummary {
  const summaries = categories
    .filter((c) => c !== "varmrett")
    .map((c) => summarizeCategoryDay(slots, date, tier, c, catalog));
  const varmrett = summarizeSharedVarmrettDay(slots, date, catalog);
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
    statusLabelKey: s.statusLabelKey,
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
    dayStatusLabelKey: statusChipLabelKey(dayStatus),
    varmrett,
    enterpriseUpgrade,
    fixedGroups,
    premiumGroups,
  };
}

export type EnterpriseUpgradeQuickChoiceId =
  | "protein"
  | "portion"
  | "dessert"
  | "topping"
  | "side"
  | "season";

export type EnterpriseUpgradeQuickChoice = {
  id: EnterpriseUpgradeQuickChoiceId;
  upgradeType: EnterpriseUpgradeType;
};

export const ENTERPRISE_DEFAULT_SUGGESTION = {
  upgradeType: "PREMIUM_PROTEIN" as EnterpriseUpgradeType,
  sourcePackage: "LUXUS" as PlanTier,
};

export const ENTERPRISE_UPGRADE_QUICK_CHOICES: EnterpriseUpgradeQuickChoice[] = [
  { id: "protein", upgradeType: "PREMIUM_PROTEIN" },
  { id: "portion", upgradeType: "LARGER_PORTION" },
  { id: "dessert", upgradeType: "DESSERT_FRUIT" },
  { id: "topping", upgradeType: "OTHER" },
  { id: "side", upgradeType: "EXTRA_SIDE" },
  { id: "season", upgradeType: "OTHER" },
];

export function applyEnterpriseUpgradePreset(
  form: ResolvedProviderMenuSlot,
  preset: Pick<EnterpriseUpgradeQuickChoice, "upgradeType"> & {
    upgradeNote: string;
    sourcePackage?: PlanTier | null;
  },
): ResolvedProviderMenuSlot {
  return {
    ...form,
    upgradeType: preset.upgradeType,
    upgradeNote: preset.upgradeNote,
    sourcePackage: preset.sourcePackage ?? form.sourcePackage ?? "LUXUS",
  };
}

export function enterpriseUpgradeHasContent(form: ResolvedProviderMenuSlot): boolean {
  return Boolean(form.upgradeType) || String(form.upgradeNote ?? "").trim().length >= 8;
}
