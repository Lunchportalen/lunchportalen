/**
 * Provider-controlled full-menu apply for localized fixed week menu.
 * hotMeal → menuDay varmrett drafts; fixed categories → lunchCategory catalog merge.
 */

import "server-only";

import type { SanityClient } from "@sanity/client";

import { fetchLunchCategoryRowsForProvider } from "@/lib/cms/lunchCategory";
import {
  buildApplyIdempotencyKey,
  isSupportedApplyMenuLocale,
  LOCALIZED_MENU_GENERATOR_VERSION,
  type ApplyErrorCode,
  type ApplyLocalizedGeneratedWeekMenuInput,
  type ApplyLocalizedGeneratedWeekMenuResult,
} from "@/lib/menu-generator/applyTypes";
import {
  buildCatalogUpdateConfirmationToken,
  catalogDiffWouldUpdateExisting,
  enforceCatalogUpdatePolicy,
  isFutureMenuDaysOnlyMode,
  isReplaceCatalogWithConfirmationMode,
} from "@/lib/menu-generator/applyCatalogSafety";
import { resolveMenuApplyCapabilities } from "@/lib/menu-generator/applyCapabilities";
import { buildFullLocalizedWeekMenuDraft } from "@/lib/menu-generator/fullApplyDomain";
import { buildFullApplyDiff, fullApplyWouldMutate } from "@/lib/menu-generator/fullApplyDiff";
import { applyCatalogCategories } from "@/lib/menu-generator/fullApplyWrite";
import { buildApplyWeekDiff, summarizeApplyDays } from "@/lib/menu-generator/applyWeekMenuDiff";
import { isLocalizedFixedMenuGeneratorPanelEnabled } from "@/lib/menu-generator/featureFlag";
import { resolveProviderMenuRuntimeProfile } from "@/lib/menu-generator/resolveProviderMenuRuntimeProfile";
import {
  fetchSanityProviderMirrorSnapshot,
  runProviderMirrorPreflight,
  type ProviderMirrorPreflightResult,
  type ProviderMirrorSnapshot,
} from "@/lib/menu-generator/providerMirrorPreflight";
import type { FixedCategoryKey } from "@/lib/menu-generator/types";
import type { EnvLike } from "@/lib/menu-profile/featureFlag";
import { resolveApplyMenuCatalogSnapshot } from "@/lib/provider-menu/providerMenuCatalogReadModel";
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
  /** Read-only Sanity client for provider mirror preflight (dryRun + apply). */
  sanityReadClient?: Pick<SanityClient, "fetch"> | null;
  providerSlug?: string | null;
  /** Test hook — overrides Sanity mirror fetch. */
  fetchProviderMirror?: (providerId: string) => Promise<ProviderMirrorSnapshot | null>;
};

import { parseApplyLocalizedGeneratedWeekMenuBody } from "@/lib/menu-generator/applyLocalizedGeneratedWeekMenuBody";
export { parseApplyLocalizedGeneratedWeekMenuBody };

async function resolveProviderMirrorPreflight(
  ctx: ApplyLocalizedGeneratedWeekMenuContext,
  input: ApplyLocalizedGeneratedWeekMenuInput,
): Promise<ProviderMirrorPreflightResult> {
  const fetchMirror =
    ctx.fetchProviderMirror ??
    (async (providerId: string) => {
      const client = ctx.sanityReadClient ?? ctx.sanityClient;
      if (!client) return null;
      return fetchSanityProviderMirrorSnapshot(client.fetch.bind(client), providerId);
    });

  return runProviderMirrorPreflight({
    providerId: input.providerId,
    expectedSlug: input.providerSlug ?? ctx.providerSlug ?? null,
    mode: input.dryRun ? "dry_run" : "apply",
    fetchMirror,
  });
}

function withMirrorPreflightFields(
  result: ApplyLocalizedGeneratedWeekMenuResult,
  preflight: ProviderMirrorPreflightResult,
): ApplyLocalizedGeneratedWeekMenuResult {
  return {
    ...result,
    applyBlocked: preflight.applyBlocked,
    safeToApply: preflight.safeToApply,
    providerMirrorPreflight: preflight,
    blockedReasons: preflight.applyBlocked
      ? [...result.blockedReasons, preflight.message]
      : result.blockedReasons,
  };
}

function emptyResult(
  input: ApplyLocalizedGeneratedWeekMenuInput,
  partial: Partial<ApplyLocalizedGeneratedWeekMenuResult>,
): ApplyLocalizedGeneratedWeekMenuResult {
  const capabilities = resolveMenuApplyCapabilities();
  return {
    ok: false,
    mode: input.dryRun ? "dry_run" : "apply",
    providerId: input.providerId,
    weekStart: input.weekStart,
    menuLocale: input.menuLocale,
    menuProfileId: input.menuProfileId,
    categoryScope: input.categoryScope,
    generatorVersion: LOCALIZED_MENU_GENERATOR_VERSION,
    overwriteMode: input.overwriteMode,
    idempotencyKey: input.idempotencyKey,
    capabilities,
    summary: {
      createdDraftDays: 0,
      updatedDraftDays: 0,
      createdCategories: 0,
      updatedCategories: 0,
      skippedExistingCategories: 0,
      skippedPublishedCategories: 0,
      blockedPublishedCategories: 0,
      unsupportedCategories: 0,
      unchangedCategories: 0,
      totalGeneratedDays: 0,
      totalGeneratedCategories: 0,
      totalGeneratedItems: 0,
      failedDays: 0,
    },
    days: [],
    catalogCategories: [],
    warnings: [],
    blockedReasons: [],
    audit: {
      action: input.dryRun
        ? "provider.menu.localized_generator.dry_run"
        : "provider.menu.localized_generator.apply",
      dryRun: input.dryRun,
      appliedDates: [],
      appliedCatalogCategories: [],
      skippedDates: [],
      errorCount: 1,
    },
    ...partial,
  };
}

export async function applyLocalizedGeneratedWeekMenu(
  ctx: ApplyLocalizedGeneratedWeekMenuContext,
  input: ApplyLocalizedGeneratedWeekMenuInput,
): Promise<ApplyLocalizedGeneratedWeekMenuResult> {
  const capabilities = resolveMenuApplyCapabilities();

  const fail = (errorCode: ApplyErrorCode, message: string, partial?: Partial<ApplyLocalizedGeneratedWeekMenuResult>) =>
    emptyResult(input, { errorCode, message, capabilities, ...partial });

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
      categoryScope: input.categoryScope,
      packageTier: input.packageTier,
    });

  let draft;
  try {
    draft = buildFullLocalizedWeekMenuDraft({
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
  const catalogRows = await fetchLunchCategoryRowsForProvider(input.providerId);
  const catalog = await resolveApplyMenuCatalogSnapshot(catalogRows);

  const diff = buildFullApplyDiff({
    draft,
    existingRows,
    catalog,
    overwriteMode: input.overwriteMode,
    lockState,
    categoryScope: input.categoryScope,
  });

  const catalogWouldUpdate = catalogDiffWouldUpdateExisting(diff.catalogCategories);
  const catalogConfirmationToken =
    input.dryRun && catalogWouldUpdate && isReplaceCatalogWithConfirmationMode(input.overwriteMode)
      ? buildCatalogUpdateConfirmationToken(idempotencyKey)
      : undefined;

  const baseResult: ApplyLocalizedGeneratedWeekMenuResult = {
    ok: !diff.blockedReasons.length || fullApplyWouldMutate(diff),
    mode: input.dryRun ? "dry_run" : "apply",
    providerId: input.providerId,
    weekStart: input.weekStart,
    menuLocale: runtimeProfile.menuLocale,
    menuProfileId: runtimeProfile.menuProfileId,
    categoryScope: input.categoryScope,
    generatorVersion: LOCALIZED_MENU_GENERATOR_VERSION,
    overwriteMode: input.overwriteMode,
    idempotencyKey,
    capabilities,
    summary: diff.summary,
    days: diff.days,
    catalogCategories: diff.catalogCategories,
    warnings: diff.warnings,
    blockedReasons: diff.blockedReasons,
    catalogUpdateConfirmationToken: catalogConfirmationToken,
    audit: {
      action: input.dryRun
        ? "provider.menu.localized_generator.dry_run"
        : "provider.menu.localized_generator.apply",
      dryRun: input.dryRun,
      appliedDates: [],
      appliedCatalogCategories: [],
      skippedDates: [],
      errorCount: 0,
    },
    ...(diff.blockedReasons.length
      ? { errorCode: "published_days_exist" as ApplyErrorCode, message: diff.blockedReasons[0] }
      : {}),
  };

  const mirrorPreflight = await resolveProviderMirrorPreflight(ctx, input);

  if (input.dryRun) {
    return withMirrorPreflightFields(baseResult, mirrorPreflight);
  }

  if (mirrorPreflight.applyBlocked && mirrorPreflight.errorCode) {
    return fail(mirrorPreflight.errorCode, mirrorPreflight.message, {
      days: diff.days,
      catalogCategories: diff.catalogCategories,
      summary: diff.summary,
      idempotencyKey,
      applyBlocked: true,
      safeToApply: false,
      providerMirrorPreflight: mirrorPreflight,
    });
  }

  const catalogPolicyError = enforceCatalogUpdatePolicy({
    overwriteMode: input.overwriteMode,
    catalogUpdateConfirmationToken: input.catalogUpdateConfirmationToken,
    replaceCatalogConfirmationPhrase: input.replaceCatalogConfirmationPhrase,
    idempotencyKey,
    catalogWouldUpdate,
  });
  if (catalogPolicyError) {
    return fail(catalogPolicyError.errorCode, catalogPolicyError.message, {
      days: diff.days,
      catalogCategories: diff.catalogCategories,
      summary: diff.summary,
      idempotencyKey,
    });
  }

  if (!ctx.sanityClient) {
    return fail("sanity_write_failed", "Menypublisering er ikke tilgjengelig akkurat nå.", {
      days: diff.days,
      catalogCategories: diff.catalogCategories,
      summary: diff.summary,
      idempotencyKey,
    });
  }

  if (diff.blockedReasons.length > 0) {
    return fail("published_days_exist", diff.blockedReasons[0] ?? "Apply blokkert.", {
      days: diff.days,
      catalogCategories: diff.catalogCategories,
      summary: diff.summary,
      idempotencyKey,
    });
  }

  const generatedByCategory = new Map<FixedCategoryKey, typeof draft.catalogCategories[0]["items"]>();
  for (const cat of draft.catalogCategories) {
    if (cat.schemaSupport === "supported") {
      generatedByCategory.set(cat.categoryKey, cat.items);
    }
  }

  const appliedDates: string[] = [];
  const errors: Array<{ target: string; error: string }> = [];

  if (input.categoryScope !== "fixed_categories_only") {
    const varmrettDiff = buildApplyWeekDiff({
      weekStart: input.weekStart,
      dates,
      existingRows,
      varmrettByDate: diff.varmrettByDate,
      overwriteMode: input.overwriteMode,
      dryRun: true,
      lockState,
    });

    for (const day of varmrettDiff.days) {
      if (day.status !== "would_create" && day.status !== "would_update_draft") continue;
      const generated = day.generatedState;
      if (!generated) continue;

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
        errors.push({ target: day.date, error: writeResult.error });
      } else {
        appliedDates.push(day.date);
      }
    }
  }

  let appliedCatalog: FixedCategoryKey[] = [];
  if (input.categoryScope !== "hotMeal_only" && !isFutureMenuDaysOnlyMode(input.overwriteMode)) {
    const catalogResult = await applyCatalogCategories({
      client: ctx.sanityClient,
      providerId: input.providerId,
      catalog,
      catalogDiffs: diff.catalogCategories,
      generatedByCategory,
      overwriteMode: input.overwriteMode,
    });
    appliedCatalog = catalogResult.applied;
    for (const err of catalogResult.errors) {
      errors.push({ target: err.categoryKey, error: err.error });
    }
  }

  const workingVarmrett = buildApplyWeekDiff({
    weekStart: input.weekStart,
    dates,
    existingRows,
    varmrettByDate: diff.varmrettByDate,
    overwriteMode: input.overwriteMode,
    dryRun: true,
    lockState,
  });
  void summarizeApplyDays(workingVarmrett.days);

  return {
    ...withMirrorPreflightFields(baseResult, mirrorPreflight),
    ok: errors.length === 0,
    mode: "apply",
    audit: {
      action: "provider.menu.localized_generator.apply",
      dryRun: false,
      appliedDates,
      appliedCatalogCategories: appliedCatalog,
      skippedDates: [],
      errorCount: errors.length,
    },
    ...(errors.length
      ? { errorCode: "sanity_write_failed" as ApplyErrorCode, message: errors[0]?.error, ok: false }
      : { ok: true, errorCode: undefined, message: undefined }),
  };
}
