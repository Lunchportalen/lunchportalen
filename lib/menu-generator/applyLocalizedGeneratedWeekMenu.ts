/**
 * Provider-controlled apply for localized fixed week menu (draft varmrett only).
 * Uses existing writeGeneratedSharedVarmrettForProvider — no parallel write path.
 */

import "server-only";

import type { SanityClient } from "@sanity/client";

import type { PlanTier } from "@/lib/cms/menuDayContract";
import {
  buildApplyIdempotencyKey,
  DEFAULT_APPLY_OVERWRITE_MODE,
  isSupportedApplyMenuLocale,
  LOCALIZED_MENU_GENERATOR_VERSION,
  type ApplyErrorCode,
  type ApplyLocalizedGeneratedWeekMenuInput,
  type ApplyLocalizedGeneratedWeekMenuResult,
  type ApplyOverwriteMode,
} from "@/lib/menu-generator/applyTypes";
import {
  actionableApplyDates,
  buildApplyWeekDiff,
  dryRunSummaryFromDays,
  summarizeApplyDays,
  wouldMutateInDryRun,
} from "@/lib/menu-generator/applyWeekMenuDiff";
import { mapGeneratedWeekToApplyTargets } from "@/lib/menu-generator/applyWeekMenuMapper";
import {
  isLocalizedFixedMenuGeneratorPanelEnabled,
} from "@/lib/menu-generator/featureFlag";
import { resolveProviderMenuRuntimeProfile } from "@/lib/menu-generator/resolveProviderMenuRuntimeProfile";
import type { EnvLike } from "@/lib/menu-profile/featureFlag";
import { loadProviderMenuDaysForDates } from "@/lib/provider-menu/loadProviderMenuDays";
import { loadProviderOrderLockState } from "@/lib/provider-menu/providerMenuOrderLock";
import { writeGeneratedSharedVarmrettForProvider } from "@/lib/provider-menu/varmrettSharedWrite";
import { weekDatesFromStart } from "@/lib/providers/providerMenuPackageSurface";
import type { ProviderSettingsMenuProfileRow } from "@/lib/providers/loadProviderSettingsMenuProfile";
import type { MenuProfileResolverResult } from "@/lib/menu-profile/types";

export type ApplyLocalizedGeneratedWeekMenuContext = {
  env: EnvLike;
  settingsRow: ProviderSettingsMenuProfileRow | null;
  resolverResult: MenuProfileResolverResult | null;
  sanityClient: SanityClient | null;
  providerSlug?: string | null;
};

function parseOverwriteMode(raw: unknown): ApplyOverwriteMode {
  const value = String(raw ?? "").trim();
  if (
    value === "create_missing_only" ||
    value === "replace_drafts_only" ||
    value === "stop_if_any_day_exists" ||
    value === "stop_if_published_exists"
  ) {
    return value;
  }
  return DEFAULT_APPLY_OVERWRITE_MODE;
}

export function parseApplyLocalizedGeneratedWeekMenuBody(raw: unknown): {
  ok: true;
  input: Omit<ApplyLocalizedGeneratedWeekMenuInput, "providerId" | "menuLocale" | "country" | "menuProfileId">;
} | { ok: false; errorCode: ApplyErrorCode; message: string } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errorCode: "validation_failed", message: "Ugyldig request body." };
  }
  const o = raw as Record<string, unknown>;
  const weekStart = String(o.weekStart ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return { ok: false, errorCode: "validation_failed", message: "Ugyldig weekStart." };
  }

  const packageTier = String(o.packageTier ?? "LUXUS").trim().toUpperCase();
  if (packageTier !== "BASIS" && packageTier !== "LUXUS" && packageTier !== "ENTERPRISE") {
    return { ok: false, errorCode: "validation_failed", message: "Ugyldig packageTier." };
  }

  const overwriteMode = parseOverwriteMode(o.overwriteMode);
  const dryRun = o.dryRun !== false && o.dryRun !== "false";

  return {
    ok: true,
    input: {
      weekStart,
      packageTier: packageTier as PlanTier,
      overwriteMode,
      dryRun,
      idempotencyKey: String(o.idempotencyKey ?? "").trim(),
    },
  };
}

export async function applyLocalizedGeneratedWeekMenu(
  ctx: ApplyLocalizedGeneratedWeekMenuContext,
  input: ApplyLocalizedGeneratedWeekMenuInput,
): Promise<ApplyLocalizedGeneratedWeekMenuResult> {
  const fail = (
    errorCode: ApplyErrorCode,
    message: string,
    partial?: Partial<ApplyLocalizedGeneratedWeekMenuResult>,
  ): ApplyLocalizedGeneratedWeekMenuResult => ({
    ok: false,
    mode: input.dryRun ? "dry_run" : "apply",
    providerId: input.providerId,
    weekStart: input.weekStart,
    menuLocale: input.menuLocale,
    menuProfileId: input.menuProfileId,
    generatorVersion: LOCALIZED_MENU_GENERATOR_VERSION,
    overwriteMode: input.overwriteMode,
    idempotencyKey: input.idempotencyKey,
    summary: {
      createdDraftDays: 0,
      updatedDraftDays: 0,
      skippedExistingDays: 0,
      skippedPublishedDays: 0,
      blockedPublishedDays: 0,
      unchangedDays: 0,
      totalGeneratedDays: 0,
      failedDays: 0,
    },
    days: [],
    warnings: [],
    blockedReasons: [],
    audit: {
      action: input.dryRun
        ? "provider.menu.localized_generator.dry_run"
        : "provider.menu.localized_generator.apply",
      dryRun: input.dryRun,
      appliedDates: [],
      skippedDates: [],
      errorCount: 1,
    },
    errorCode,
    message,
    ...partial,
  });

  if (!isLocalizedFixedMenuGeneratorPanelEnabled(ctx.env)) {
    return fail("generator_flag_disabled", "Lokal fast menygenerator er ikke aktiv.");
  }

  if (!ctx.settingsRow) {
    return fail("provider_profile_missing", "Provider menyprofil mangler.");
  }

  if (!isSupportedApplyMenuLocale(input.menuLocale)) {
    return fail("unsupported_menu_locale", `Menylocale ${input.menuLocale} støttes ikke.`);
  }

  const runtimeProfile = resolveProviderMenuRuntimeProfile({
    providerId: input.providerId,
    country: ctx.settingsRow.defaultCountryCode,
    menuLocale: ctx.settingsRow.locale,
    menuProfileId: ctx.settingsRow.menuProfileId,
    currency: ctx.settingsRow.defaultCurrency,
    resolverResult: ctx.resolverResult,
  });

  if (runtimeProfile.menuProfileId !== input.menuProfileId) {
    return fail("validation_failed", "menuProfileId matcher ikke provider-innstillinger.");
  }

  const idempotencyKey =
    input.idempotencyKey ||
    buildApplyIdempotencyKey({
      providerId: input.providerId,
      weekStart: input.weekStart,
      menuLocale: input.menuLocale,
      menuProfileId: input.menuProfileId,
      overwriteMode: input.overwriteMode,
      packageTier: input.packageTier,
    });

  let mapped;
  try {
    mapped = mapGeneratedWeekToApplyTargets({
      providerId: input.providerId,
      weekStart: input.weekStart,
      menuLocale: runtimeProfile.menuLocale,
      country: runtimeProfile.country,
      menuProfileId: runtimeProfile.menuProfileId,
      packageTier: input.packageTier,
      enabledCategories: runtimeProfile.enabledCategories,
      economyConfig: runtimeProfile.economyConfig,
    });
  } catch {
    return fail("schema_mapping_failed", "Kunne ikke mappe generator-output til menyformat.");
  }

  const dates = weekDatesFromStart(input.weekStart).slice(0, 5);
  const lockState = await loadProviderOrderLockState(input.providerId);
  const existingRows = await loadProviderMenuDaysForDates(input.providerId, dates, {
    providerSlug: input.providerSlug ?? ctx.providerSlug ?? null,
  });

  const diffResult = buildApplyWeekDiff({
    weekStart: input.weekStart,
    dates,
    existingRows,
    varmrettByDate: mapped.varmrettByDate,
    overwriteMode: input.overwriteMode,
    dryRun: input.dryRun,
    lockState,
  });

  if (input.dryRun) {
    return {
      ok: diffResult.blockedReasons.length === 0 || wouldMutateInDryRun(diffResult.days),
      mode: "dry_run",
      providerId: input.providerId,
      weekStart: input.weekStart,
      menuLocale: runtimeProfile.menuLocale,
      menuProfileId: runtimeProfile.menuProfileId,
      generatorVersion: LOCALIZED_MENU_GENERATOR_VERSION,
      overwriteMode: input.overwriteMode,
      idempotencyKey,
      summary: dryRunSummaryFromDays(diffResult.days),
      days: diffResult.days,
      warnings: diffResult.warnings,
      blockedReasons: diffResult.blockedReasons,
      audit: {
        action: "provider.menu.localized_generator.dry_run",
        dryRun: true,
        appliedDates: [],
        skippedDates: diffResult.days
          .filter((d) => d.status.startsWith("skipped") || d.status === "unchanged")
          .map((d) => d.date),
        errorCount: diffResult.days.filter((d) => d.status === "failed").length,
      },
      ...(diffResult.blockedReasons.length
        ? { errorCode: "published_days_exist" as ApplyErrorCode, message: diffResult.blockedReasons[0] }
        : {}),
    };
  }

  if (!ctx.sanityClient) {
    return fail("sanity_write_failed", "Menypublisering er ikke tilgjengelig akkurat nå.");
  }

  if (diffResult.blockedReasons.length > 0) {
    return fail("published_days_exist", diffResult.blockedReasons[0] ?? "Apply blokkert.", {
      days: diffResult.days,
      blockedReasons: diffResult.blockedReasons,
      warnings: diffResult.warnings,
      summary: dryRunSummaryFromDays(diffResult.days),
      idempotencyKey,
    });
  }

  const appliedDates: string[] = [];
  const skippedDates: string[] = [];
  const errors: Array<{ date: string; error: string }> = [];
  const workingDays = [...diffResult.days];

  for (const day of workingDays) {
    if (day.status !== "would_create" && day.status !== "would_update_draft") {
      if (day.status === "skipped_existing" || day.status === "skipped_published" || day.status === "unchanged") {
        skippedDates.push(day.date);
      }
      continue;
    }

    const generated = day.generatedState;
    if (!generated) {
      errors.push({ date: day.date, error: "Mangler generert varmrett." });
      day.status = "failed";
      continue;
    }

    const writeResult = await writeGeneratedSharedVarmrettForProvider(
      ctx.sanityClient,
      input.providerId,
      {
        date: day.date,
        mealTitle: generated.mealTitle,
        description: generated.description,
        allergensText: generated.allergensText,
        estimatedCostPerPortion: null,
        status: "draft",
        confirmWarnings: true,
      },
      { providerSlug: input.providerSlug ?? ctx.providerSlug ?? null },
    );

    if (writeResult.ok === false) {
      errors.push({ date: day.date, error: writeResult.error });
      day.status = "failed";
      day.warnings.push(writeResult.error);
    } else {
      day.status = day.status === "would_create" ? "created" : "updated_draft";
      appliedDates.push(day.date);
    }
  }

  const summary = summarizeApplyDays(workingDays);
  const ok = errors.length === 0 && (appliedDates.length > 0 || summary.unchangedDays > 0 || skippedDates.length > 0);

  return {
    ok,
    mode: "apply",
    providerId: input.providerId,
    weekStart: input.weekStart,
    menuLocale: runtimeProfile.menuLocale,
    menuProfileId: runtimeProfile.menuProfileId,
    generatorVersion: LOCALIZED_MENU_GENERATOR_VERSION,
    overwriteMode: input.overwriteMode,
    idempotencyKey,
    summary,
    days: workingDays,
    warnings: diffResult.warnings,
    blockedReasons: diffResult.blockedReasons,
    audit: {
      action: "provider.menu.localized_generator.apply",
      dryRun: false,
      appliedDates: actionableApplyDates(workingDays),
      skippedDates: [...new Set([...skippedDates, ...workingDays.filter((d) => d.status === "skipped_published").map((d) => d.date)])],
      errorCount: errors.length,
    },
    ...(errors.length ? { errorCode: "sanity_write_failed" as ApplyErrorCode, message: errors[0]?.error } : {}),
  };
}
