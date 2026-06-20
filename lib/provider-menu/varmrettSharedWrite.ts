import "server-only";

import type { SanityClient } from "@sanity/client";

import type { PlanTier } from "@/lib/cms/menuDayContract";
import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";
import { getVisibleWindow, weekStartMon } from "@/lib/week/availability";
import type { ProviderMenuDayRow } from "@/lib/provider-menu/loadProviderMenuDays";
import {
  buildMenuDayPayload,
  type MenuDayInput,
  type MenuDayStatus,
} from "@/lib/provider-menu/menuDayPayload";
import { loadProviderMenuDaysForDates } from "@/lib/provider-menu/loadProviderMenuDays";
import {
  assertVarmrettContentChangeAllowed,
  isVarmrettDateLocked,
  loadProviderOrderLockState,
  type ProviderOrderLockState,
} from "@/lib/provider-menu/providerMenuOrderLock";

export const VARMRETT_SHARED_TIERS = ["BASIS", "LUXUS", "ENTERPRISE"] as const satisfies readonly PlanTier[];

export type GeneratedBaseline = {
  mealTitle: string;
  description: string;
  allergens?: string[];
  estimatedCostPerPortion?: number;
};

export type VarmrettSharedInput = {
  date: string;
  mealTitle: string;
  description: string;
  allergensText?: string | null;
  estimatedCostPerPortion?: number | null;
  status: MenuDayStatus;
  confirmWarnings?: boolean;
};

export type VarmrettSharedWriteResult =
  | { ok: true; date: string; status: MenuDayStatus; reconciledDates: string[]; warnings?: string[] }
  | { ok: false; error: string; field?: string };

function safeTrimField(value: unknown, max = 4000): string {
  return String(value ?? "").trim().slice(0, max);
}

function getWeekdaysMonFri(weekStartISO: string): string[] {
  return [0, 1, 2, 3, 4].map((i) => addDaysISO(weekStartISO, i));
}

function isoFromDateOsloWall(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

/** Datoer ansatt kan se i /order/window (3-ukers modus). */
export function getEmployeeVisibleOrderDates(now: Date = new Date()): string[] {
  const window = getVisibleWindow(now);
  const today = osloTodayISODate();
  const thisWeekStartISO = isoFromDateOsloWall(weekStartMon(now));
  const nextWeekStartISO = addDaysISO(thisWeekStartISO, 7);
  const thirdWeekStartISO = addDaysISO(thisWeekStartISO, 14);

  const thisWeekDatesAll = getWeekdaysMonFri(thisWeekStartISO);
  const nextWeekDatesAll = getWeekdaysMonFri(nextWeekStartISO);
  const thirdWeekDatesAll = getWeekdaysMonFri(thirdWeekStartISO);

  const thisWeekDatesFiltered = thisWeekDatesAll.filter((d) => d >= today);
  const thisWeekHead = thisWeekDatesFiltered.length ? thisWeekDatesFiltered : thisWeekDatesAll;

  const dates: string[] = [];
  if (window.showCurrent) dates.push(...thisWeekHead);
  if (window.showNext) dates.push(...nextWeekDatesAll);
  if (window.showThird) dates.push(...thirdWeekDatesAll);

  return [...new Set(dates)].slice(0, 15);
}

export function snapshotBaselineFromRow(row: ProviderMenuDayRow): GeneratedBaseline {
  return {
    mealTitle: row.mealTitle,
    description: row.description,
    allergens: [...row.allergens],
    estimatedCostPerPortion: row.estimatedCostPerPortion ?? undefined,
  };
}

export function varmrettTierSignatures(rows: readonly ProviderMenuDayRow[], date: string): string[] {
  return VARMRETT_SHARED_TIERS.map((tier) => {
    const row = rows.find((r) => r.date === date && r.tier === tier && r.category === "varmrett");
    if (!row) return `${tier}:`;
    return `${tier}:${row.mealTitle.trim()}|${row.description.trim()}`;
  });
}

export function isVarmrettDivergentForDate(rows: readonly ProviderMenuDayRow[], date: string): boolean {
  const sigs = varmrettTierSignatures(rows, date)
    .map((s) => s.split(":").slice(1).join(":"))
    .filter((s) => s.length > 0);
  if (sigs.length <= 1) return false;
  return new Set(sigs).size > 1;
}

type ExtendedRow = ProviderMenuDayRow & {
  providerOverride?: boolean;
  generatedBaseline?: GeneratedBaseline | null;
  autoFilled?: boolean;
};

function resolveBaselineForRow(row: ExtendedRow | undefined): GeneratedBaseline | null {
  if (!row) return null;
  if (row.generatedBaseline?.mealTitle?.trim() || row.generatedBaseline?.description?.trim()) {
    return row.generatedBaseline;
  }
  if (row.mealTitle.trim() || row.description.trim()) {
    return snapshotBaselineFromRow(row);
  }
  return null;
}

function buildTierInput(
  date: string,
  tier: PlanTier,
  shared: VarmrettSharedInput,
  existing: ExtendedRow | undefined,
  luxusCost: number | null,
): MenuDayInput {
  return {
    date,
    tier,
    category: "varmrett",
    mealTitle: shared.mealTitle,
    description: shared.description,
    allergensText: shared.allergensText ?? null,
    estimatedCostPerPortion: shared.estimatedCostPerPortion ?? null,
    status: shared.status,
    confirmWarnings: shared.confirmWarnings,
    sourcePackage: tier === "ENTERPRISE" ? (existing?.sourcePackage ?? null) : null,
    upgradeType: tier === "ENTERPRISE" ? (existing?.upgradeType ?? null) : null,
    upgradeNote: tier === "ENTERPRISE" ? (existing?.upgradeNote ?? null) : null,
    luxusEstimatedCost: tier === "ENTERPRISE" ? luxusCost : null,
  };
}

async function writeVarmrettDateAllTiers(
  client: SanityClient,
  providerId: string,
  shared: VarmrettSharedInput,
  rowsForDate: ExtendedRow[],
  opts?: { providerOverride?: boolean; preserveBaseline?: GeneratedBaseline | null; lockState?: ProviderOrderLockState },
): Promise<{ ok: true; warnings: string[] } | { ok: false; error: string; field?: string }> {
  const lockState = opts?.lockState ?? (await loadProviderOrderLockState(providerId));
  const canonical = rowsForDate.find((r) => r.tier === "BASIS") ?? rowsForDate[0];
  const beforeContent = {
    mealTitle: canonical?.mealTitle ?? "",
    description: canonical?.description ?? "",
    allergensText: canonical?.allergens?.join(", ") ?? "",
    estimatedCostPerPortion: canonical?.estimatedCostPerPortion ?? null,
  };
  try {
    assertVarmrettContentChangeAllowed(lockState, shared.date, beforeContent, {
      mealTitle: shared.mealTitle,
      description: shared.description,
      allergensText: shared.allergensText ?? "",
      estimatedCostPerPortion: shared.estimatedCostPerPortion ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Varmrett er låst.";
    return { ok: false, error: msg, field: "date" };
  }

  const warnings: string[] = [];
  const baseline =
    opts?.preserveBaseline ??
    resolveBaselineForRow(rowsForDate.find((r) => r.generatedBaseline?.mealTitle || r.autoFilled)) ??
    resolveBaselineForRow(rowsForDate[0]);

  for (const tier of VARMRETT_SHARED_TIERS) {
    const existing = rowsForDate.find((r) => r.tier === tier);
    const luxusCost = rowsForDate.find((r) => r.tier === "LUXUS")?.estimatedCostPerPortion ?? null;
    const input = buildTierInput(shared.date, tier, shared, existing, luxusCost);
    const payloadResult = buildMenuDayPayload(providerId, input, { existingSlot: existing ?? null });
    if (payloadResult.ok === false) {
      return { ok: false, error: payloadResult.error, field: payloadResult.field };
    }

    const patch = {
      ...payloadResult.payload,
      providerOverride: opts?.providerOverride ?? true,
      ...(baseline ? { generatedBaseline: baseline } : {}),
    };

    await client.createOrReplace(patch);
    if (payloadResult.warnings?.length) warnings.push(...payloadResult.warnings);
  }

  return { ok: true, warnings: [...new Set(warnings)] };
}

export async function writeSharedVarmrettForProvider(
  client: SanityClient,
  providerId: string,
  input: VarmrettSharedInput,
  opts?: { providerSlug?: string | null; reconcileVisibleWindow?: boolean },
): Promise<VarmrettSharedWriteResult> {
  const date = safeTrimField(input.date, 10);
  const lockState = await loadProviderOrderLockState(providerId);
  const rows = (await loadProviderMenuDaysForDates(providerId, [date], {
    providerSlug: opts?.providerSlug ?? null,
  })) as ExtendedRow[];

  const writeResult = await writeVarmrettDateAllTiers(client, providerId, input, rows, {
    providerOverride: true,
    lockState,
  });
  if (writeResult.ok === false) {
    return { ok: false, error: writeResult.error, field: writeResult.field };
  }

  const reconciledDates: string[] = [];
  if (opts?.reconcileVisibleWindow !== false) {
    const visibleDates = getEmployeeVisibleOrderDates();
    const otherDates = visibleDates.filter((d) => d !== date);
    if (otherDates.length > 0) {
      const visibleRows = (await loadProviderMenuDaysForDates(providerId, otherDates, {
        providerSlug: opts?.providerSlug ?? null,
      })) as ExtendedRow[];

      for (const visibleDate of otherDates) {
        if (isVarmrettDateLocked(lockState, visibleDate)) continue;
        if (!isVarmrettDivergentForDate(visibleRows, visibleDate)) continue;
        const dateRows = visibleRows.filter((r) => r.date === visibleDate && r.category === "varmrett");
        const canonical = dateRows.find((r) => r.status === "published") ?? dateRows[0];
        if (!canonical) continue;

        const reconcileInput: VarmrettSharedInput = {
          date: visibleDate,
          mealTitle: canonical.mealTitle,
          description: canonical.description,
          allergensText: canonical.allergens.join(", ") || null,
          estimatedCostPerPortion: canonical.estimatedCostPerPortion,
          status: canonical.status === "published" ? "published" : "draft",
          confirmWarnings: true,
        };

        const reconcileResult = await writeVarmrettDateAllTiers(
          client,
          providerId,
          reconcileInput,
          dateRows,
          { providerOverride: false, lockState },
        );
        if (reconcileResult.ok) reconciledDates.push(visibleDate);
      }
    }
  }

  return {
    ok: true,
    date,
    status: input.status,
    reconciledDates,
    warnings: writeResult.warnings.length ? writeResult.warnings : undefined,
  };
}

export async function resetSharedVarmrettToBaseline(
  client: SanityClient,
  providerId: string,
  date: string,
  opts?: { providerSlug?: string | null },
): Promise<VarmrettSharedWriteResult> {
  const lockState = await loadProviderOrderLockState(providerId);
  const rows = (await loadProviderMenuDaysForDates(providerId, [date], {
    providerSlug: opts?.providerSlug ?? null,
  })) as ExtendedRow[];

  const baseline =
    resolveBaselineForRow(rows.find((r) => r.generatedBaseline)) ??
    resolveBaselineForRow(rows.find((r) => r.autoFilled)) ??
    resolveBaselineForRow(rows[0]);

  if (!baseline?.mealTitle?.trim() && !baseline?.description?.trim()) {
    return {
      ok: false,
      error: "Ingen generert baseline å gjenopprette fra for denne dagen.",
      field: "date",
    };
  }

  const status: MenuDayStatus = rows.some((r) => r.status === "published") ? "published" : "draft";

  const resetInput: VarmrettSharedInput = {
    date,
    mealTitle: baseline.mealTitle,
    description: baseline.description,
    allergensText: baseline.allergens?.join(", ") ?? null,
    estimatedCostPerPortion: baseline.estimatedCostPerPortion ?? null,
    status,
    confirmWarnings: true,
  };

  const writeResult = await writeVarmrettDateAllTiers(client, providerId, resetInput, rows, {
    providerOverride: false,
    preserveBaseline: baseline,
    lockState,
  });
  if (writeResult.ok === false) {
    return { ok: false, error: writeResult.error, field: writeResult.field };
  }

  return {
    ok: true,
    date,
    status,
    reconciledDates: [],
    warnings: writeResult.warnings.length ? writeResult.warnings : undefined,
  };
}

export function parseVarmrettSharedBody(raw: unknown): VarmrettSharedInput | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const status = safeTrimField(o.status, 16).toLowerCase();
  if (status !== "draft" && status !== "published") return null;
  const costRaw = o.estimatedCostPerPortion;
  return {
    date: safeTrimField(o.date, 10),
    mealTitle: safeTrimField(o.mealTitle, 120),
    description: safeTrimField(o.description, 4000),
    allergensText: o.allergensText != null ? safeTrimField(o.allergensText, 2000) : null,
    estimatedCostPerPortion:
      costRaw != null && costRaw !== "" && Number.isFinite(Number(costRaw)) ? Number(costRaw) : null,
    status: status as MenuDayStatus,
    confirmWarnings: Boolean(o.confirmWarnings),
  };
}
