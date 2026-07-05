/**
 * Diff engine — compare existing varmrett menuDays against generated hotMeal output.
 */

import type { ProviderMenuDayRow } from "@/lib/provider-menu/loadProviderMenuDays";
import { menuSlotHasContent } from "@/lib/provider-menu/menuCategoryCanonical";
import { isVarmrettDateLocked, type ProviderOrderLockState } from "@/lib/provider-menu/providerMenuOrderLock";
import { WEEKDAY_KEYS } from "@/lib/providers/providerMenuPackageSurface";
import type {
  ApplyDayDiff,
  ApplyDayStatus,
  ApplyExistingDayState,
  ApplyGeneratedVarmrettState,
  ApplyMenuDayDiffField,
  ApplyOverwriteMode,
  ApplySummary,
} from "@/lib/menu-generator/applyTypes";
import { normalizeAllergenListForCompare } from "@/lib/menu-generator/allergenMenuDayFormat";

const WEEKDAY_LABELS: Record<string, string> = {
  mon: "Mandag",
  tue: "Tirsdag",
  wed: "Onsdag",
  thu: "Torsdag",
  fri: "Fredag",
};

function weekdayLabelForDate(date: string, weekStart: string): string {
  const dates = [0, 1, 2, 3, 4].map((i) => {
    const d = new Date(`${weekStart}T12:00:00`);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const idx = dates.indexOf(date);
  const key = WEEKDAY_KEYS[idx] ?? "mon";
  return WEEKDAY_LABELS[key] ?? date;
}

function canonicalVarmrettRow(rows: readonly ProviderMenuDayRow[], date: string): ProviderMenuDayRow | null {
  const dayRows = rows.filter((r) => r.date === date && r.category === "varmrett");
  if (!dayRows.length) return null;
  return dayRows.find((r) => r.tier === "BASIS") ?? dayRows[0] ?? null;
}

export function resolveVarmrettExistingState(
  rows: readonly ProviderMenuDayRow[],
  date: string,
  lockState: ProviderOrderLockState,
): ApplyExistingDayState {
  if (isVarmrettDateLocked(lockState, date)) return "order_locked";
  const row = canonicalVarmrettRow(rows, date);
  if (!row || !menuSlotHasContent(row)) return "missing";
  if (row.status === "published" || (row.approvedForPublish && row.customerVisible)) return "published";
  return "draft";
}

function buildContentDiff(
  existing: ProviderMenuDayRow | null,
  generated: ApplyGeneratedVarmrettState,
): ApplyMenuDayDiffField[] {
  const diffs: ApplyMenuDayDiffField[] = [];
  const beforeTitle = existing?.mealTitle?.trim() ?? "";
  const beforeDesc = existing?.description?.trim() ?? "";
  const beforeAllergens = normalizeAllergenListForCompare(existing?.allergens ?? []);
  const afterAllergens = normalizeAllergenListForCompare(
    generated.allergensText.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean),
  );

  if (beforeTitle !== generated.mealTitle.trim()) {
    diffs.push({ field: "mealTitle", before: beforeTitle, after: generated.mealTitle.trim() });
  }
  if (beforeDesc !== generated.description.trim()) {
    diffs.push({ field: "description", before: beforeDesc, after: generated.description.trim() });
  }
  if (beforeAllergens !== afterAllergens) {
    diffs.push({
      field: "allergens",
      before: existing?.allergens?.join(", ") ?? "",
      after: generated.allergensText,
    });
  }
  return diffs;
}

function contentMatches(existing: ProviderMenuDayRow | null, generated: ApplyGeneratedVarmrettState): boolean {
  return buildContentDiff(existing, generated).length === 0;
}

function resolveDayStatus(input: {
  existingState: ApplyExistingDayState;
  overwriteMode: ApplyOverwriteMode;
  hasGenerated: boolean;
  contentMatches: boolean;
  dryRun: boolean;
  weekBlocked: boolean;
}): { status: ApplyDayStatus; warnings: string[] } {
  const warnings: string[] = [];

  if (!input.hasGenerated) {
    return { status: "failed", warnings: ["Ingen varmrett generert for denne dagen."] };
  }

  if (input.weekBlocked) {
    return { status: "blocked_published", warnings: ["Uken er blokkert av overwrite-regel."] };
  }

  if (input.existingState === "order_locked") {
    return { status: "failed", warnings: ["Varmrett er låst på grunn av aktiv bestilling."] };
  }

  if (input.existingState === "published") {
    return { status: "skipped_published", warnings: ["Publisert dag hoppes over — overskrives ikke."] };
  }

  if (input.existingState === "missing") {
    return { status: "would_create", warnings };
  }

  if (input.existingState === "draft") {
    if (input.overwriteMode === "create_missing_only") {
      return { status: "skipped_existing", warnings: ["Utkast finnes — create_missing_only hopper over."] };
    }
    if (input.contentMatches) {
      return { status: "unchanged", warnings: ["Ingen endring i utkast."] };
    }
    return { status: "would_update_draft", warnings };
  }

  return { status: "failed", warnings: ["Ukjent eksisterende tilstand."] };
}

export function buildApplyWeekDiff(input: {
  weekStart: string;
  dates: readonly string[];
  existingRows: readonly ProviderMenuDayRow[];
  varmrettByDate: Map<string, ApplyGeneratedVarmrettState>;
  overwriteMode: ApplyOverwriteMode;
  dryRun: boolean;
  lockState: ProviderOrderLockState;
}): { days: ApplyDayDiff[]; blockedReasons: string[]; warnings: string[] } {
  const blockedReasons: string[] = [];
  const warnings: string[] = [];

  const publishedDates = input.dates.filter(
    (d) => resolveVarmrettExistingState(input.existingRows, d, input.lockState) === "published",
  );
  const existingContentDates = input.dates.filter((d) => {
    const state = resolveVarmrettExistingState(input.existingRows, d, input.lockState);
    return state === "draft" || state === "published";
  });

  let weekBlocked = false;
  if (input.overwriteMode === "stop_if_published_exists" && publishedDates.length > 0) {
    weekBlocked = true;
    blockedReasons.push(
      `Publiserte varmrett-dager finnes (${publishedDates.join(", ")}). Apply er blokkert.`,
    );
  }
  if (input.overwriteMode === "stop_if_any_day_exists" && existingContentDates.length > 0) {
    weekBlocked = true;
    blockedReasons.push(
      `Meny finnes allerede for uken (${existingContentDates.join(", ")}). Apply er blokkert.`,
    );
  }

  const days: ApplyDayDiff[] = input.dates.map((date) => {
    const generated = input.varmrettByDate.get(date) ?? null;
    const existingState = resolveVarmrettExistingState(input.existingRows, date, input.lockState);
    const canonical = canonicalVarmrettRow(input.existingRows, date);
    const diff = generated && canonical ? buildContentDiff(canonical, generated) : generated && !canonical
      ? buildContentDiff(null, generated)
      : [];

    const { status, warnings: dayWarnings } = resolveDayStatus({
      existingState,
      overwriteMode: input.overwriteMode,
      hasGenerated: Boolean(generated),
      contentMatches: generated ? contentMatches(canonical, generated) : false,
      dryRun: input.dryRun,
      weekBlocked,
    });

    let providerLabel = "Ny dag opprettes";
    if (status === "would_update_draft" || status === "updated_draft") providerLabel = "Utkast oppdateres";
    else if (status === "skipped_published" || status === "blocked_published") {
      providerLabel = "Publisert dag hoppes over";
    } else if (status === "skipped_existing") providerLabel = "Eksisterende utkast hoppes over";
    else if (status === "unchanged") providerLabel = "Ingen endring";
    else if (status === "failed") providerLabel = "Blokkert";

    if (dayWarnings.length) warnings.push(...dayWarnings.map((w) => `${date}: ${w}`));

    return {
      date,
      weekday: weekdayLabelForDate(date, input.weekStart),
      status,
      existingState,
      generatedState: generated,
      diff,
      warnings: dayWarnings,
      providerLabel,
    };
  });

  return { days, blockedReasons, warnings: [...new Set(warnings)] };
}

export function summarizeApplyDays(days: readonly ApplyDayDiff[]): ApplySummary {
  const count = (pred: (d: ApplyDayDiff) => boolean) => days.filter(pred).length;
  return {
    createdDraftDays: count((d) => d.status === "created"),
    updatedDraftDays: count((d) => d.status === "updated_draft"),
    skippedExistingDays: count((d) => d.status === "skipped_existing"),
    skippedPublishedDays: count((d) => d.status === "skipped_published"),
    blockedPublishedDays: count((d) => d.status === "blocked_published"),
    unchangedDays: count((d) => d.status === "unchanged"),
    totalGeneratedDays: days.filter((d) => d.generatedState).length,
    failedDays: count((d) => d.status === "failed"),
  };
}

export function dryRunSummaryFromDays(days: readonly ApplyDayDiff[]): ApplySummary {
  const count = (pred: (d: ApplyDayDiff) => boolean) => days.filter(pred).length;
  return {
    createdDraftDays: count((d) => d.status === "would_create"),
    updatedDraftDays: count((d) => d.status === "would_update_draft"),
    skippedExistingDays: count((d) => d.status === "skipped_existing"),
    skippedPublishedDays: count((d) => d.status === "skipped_published"),
    blockedPublishedDays: count((d) => d.status === "blocked_published"),
    unchangedDays: count((d) => d.status === "unchanged"),
    totalGeneratedDays: days.filter((d) => d.generatedState).length,
    failedDays: count((d) => d.status === "failed"),
  };
}

export function actionableApplyDates(days: readonly ApplyDayDiff[]): string[] {
  return days
    .filter((d) => d.status === "created" || d.status === "updated_draft" || d.status === "would_create" || d.status === "would_update_draft")
    .map((d) => d.date);
}

export function pendingApplyDates(days: readonly ApplyDayDiff[]): string[] {
  return days
    .filter((d) => d.status === "would_create" || d.status === "would_update_draft")
    .map((d) => d.date);
}

export function wouldMutateInDryRun(days: readonly ApplyDayDiff[]): boolean {
  return days.some((d) => d.status === "would_create" || d.status === "would_update_draft");
}
