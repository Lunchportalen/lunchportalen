/**
 * Phase 4 — SUPERSMART enterprise control layer (read-only health + overview).
 * No order write-path, no flag mutation, no DB schema changes.
 */

import type { Category } from "@/lib/cms/menuDayContract";
import { CATEGORY_LABELS } from "@/lib/cms/menuDayContract";
import {
  isMenuProfileResolverEnabled,
  type EnvLike,
} from "@/lib/menu-profile/featureFlag";
import { resolveMarketMenuProfileFromProviderLocale } from "@/lib/menu-profile/localeMenuProfileMapping";
import {
  buildProfileRuntimeCategoryLabels,
} from "@/lib/menu-profile/profileMenuRuntime";
import type { MenuProfile } from "@/lib/menu-profile/types";
import { MENU_PROFILE_IDS } from "@/lib/menu-profile/types";
import type { MenuProfileResolverResult, MenuProfileResolveSource } from "@/lib/menu-profile/types";
import { getMenuProfile } from "@/lib/menu-profile/registry";
import {
  providerSettingsRowToMenuProfileInput,
  type ProviderSettingsMenuProfileRow,
} from "@/lib/providers/loadProviderSettingsMenuProfile";
import { resolveProviderMenuProfileFromSettings } from "@/lib/menu-profile/providerMenuProfileResolver";
import { resolveProfileWarmDishGenerationContext } from "@/lib/provider-menu/profileWarmDishGeneration";
import type { ProfileWarmDishGenerationContext } from "@/lib/provider-menu/profileWarmDishGeneration";
import { getWarmDishBankSeedsForProfile } from "@/lib/menu-profile/warmDishBankSeeds";

const RUNTIME_CATEGORY_LIST: readonly Category[] = [
  "paasmurt",
  "salat",
  "sushi",
  "pokebowl",
  "thai",
  "varmrett",
];

export type ProviderMenuProfileHealthStatus = "ok" | "legacy" | "error" | "warning";

export type ProviderMenuProfileHealth = {
  providerId: string;
  resolverFlagOn: boolean;
  profileResolved: "OK" | "FAIL";
  fallbackActive: boolean;
  resolveSource: MenuProfileResolveSource | "legacy_disabled" | null;
  locale: string | null;
  menuProfileId: string | null;
  country: string | null;
  currency: string | null;
  warmDishBankCount: number;
  categoryLabelCoverage: { covered: number; total: number };
  generationEnabled: boolean;
  generationReason: string | null;
  localeProfileMismatch: boolean;
  mismatchDetail: string | null;
  warning: string | null;
  readiness: ProviderMenuProfileHealthStatus;
  lastGenerationAt: string | null;
  lastGenerationSummary: string | null;
};

export type SuperadminMenuProfileOverviewRow = {
  providerId: string;
  providerName: string;
  locale: string | null;
  menuProfileId: string | null;
  country: string | null;
  currency: string | null;
  resolverStatus: "ON" | "OFF";
  profileResolved: "OK" | "FAIL";
  generationEnabled: boolean;
  warmDishBankCount: number;
  warning: string | null;
  mismatch: boolean;
  readiness: ProviderMenuProfileHealthStatus;
  lastGenerationAt: string | null;
  lastGenerationSummary: string | null;
};

function generationInactiveReason(ctx: ProfileWarmDishGenerationContext): string | null {
  if (ctx.active === false) return ctx.reason;
  return null;
}

function categoryLabelCoverage(profile: MenuProfile) {
  const labels = buildProfileRuntimeCategoryLabels(profile);
  let covered = 0;
  for (const category of RUNTIME_CATEGORY_LIST) {
    const label = labels[category];
    if (label && label !== CATEGORY_LABELS[category]) covered += 1;
  }
  return { covered, total: RUNTIME_CATEGORY_LIST.length };
}

export function detectLocaleMenuProfileMismatch(row: ProviderSettingsMenuProfileRow): {
  mismatch: boolean;
  detail: string | null;
} {
  if (!row.menuProfileId) return { mismatch: false, detail: null };
  const fromLocale = resolveMarketMenuProfileFromProviderLocale(row.locale);
  if (fromLocale.menuProfileId === row.menuProfileId) return { mismatch: false, detail: null };
  return {
    mismatch: true,
    detail: `locale ${row.locale} maps to ${fromLocale.menuProfileId}, settings has ${row.menuProfileId}`,
  };
}

export function buildProviderMenuProfileHealth(input: {
  row: ProviderSettingsMenuProfileRow | null;
  resolverResult: MenuProfileResolverResult | null;
  env?: EnvLike;
  lastGenerationAt?: string | null;
  lastGenerationSummary?: string | null;
}): ProviderMenuProfileHealth | null {
  const { row, resolverResult, env = {}, lastGenerationAt = null, lastGenerationSummary = null } = input;
  if (!row) return null;

  const resolverFlagOn = isMenuProfileResolverEnabled(env);
  const mismatch = detectLocaleMenuProfileMismatch(row);
  const generationCtx = resolveProfileWarmDishGenerationContext(resolverResult, env);

  if (!resolverFlagOn || !resolverResult?.ok) {
    return {
      providerId: row.providerId,
      resolverFlagOn,
      profileResolved: "FAIL",
      fallbackActive: false,
      resolveSource: resolverResult?.ok === false ? null : "legacy_disabled",
      locale: row.locale,
      menuProfileId: row.menuProfileId,
      country: row.defaultCountryCode,
      currency: row.defaultCurrency,
      warmDishBankCount: 0,
      categoryLabelCoverage: { covered: 0, total: RUNTIME_CATEGORY_LIST.length },
      generationEnabled: false,
      generationReason: generationInactiveReason(generationCtx),
      localeProfileMismatch: mismatch.mismatch,
      mismatchDetail: mismatch.detail,
      warning: resolverResult?.ok === false ? resolverResult.message : null,
      readiness: resolverFlagOn ? "error" : "legacy",
      lastGenerationAt,
      lastGenerationSummary,
    };
  }

  if (!resolverResult.enabled) {
    return {
      providerId: row.providerId,
      resolverFlagOn,
      profileResolved: "FAIL",
      fallbackActive: false,
      resolveSource: "legacy_disabled",
      locale: row.locale,
      menuProfileId: row.menuProfileId,
      country: row.defaultCountryCode,
      currency: row.defaultCurrency,
      warmDishBankCount: 0,
      categoryLabelCoverage: { covered: 0, total: RUNTIME_CATEGORY_LIST.length },
      generationEnabled: false,
      generationReason: "resolver_disabled",
      localeProfileMismatch: mismatch.mismatch,
      mismatchDetail: mismatch.detail,
      warning: null,
      readiness: "legacy",
      lastGenerationAt,
      lastGenerationSummary,
    };
  }

  const profile = resolverResult.profile;
  const fallbackActive =
    resolverResult.source === "market_default" ||
    resolverResult.source === "fallback_no_market" ||
    Boolean(resolverResult.warning);
  const bankCount = generationCtx.active ? generationCtx.seedCount : 0;
  const coverage = categoryLabelCoverage(profile);

  let readiness: ProviderMenuProfileHealthStatus = "ok";
  if (mismatch.mismatch || resolverResult.warning) readiness = "warning";
  if (generationCtx.active === false && generationCtx.reason === "empty_bank") readiness = "warning";

  return {
    providerId: row.providerId,
    resolverFlagOn,
    profileResolved: "OK",
    fallbackActive,
    resolveSource: resolverResult.source,
    locale: row.locale,
    menuProfileId: profile.id,
    country: row.defaultCountryCode,
    currency: row.defaultCurrency,
    warmDishBankCount: bankCount,
    categoryLabelCoverage: coverage,
    generationEnabled: generationCtx.active,
    generationReason: generationInactiveReason(generationCtx),
    localeProfileMismatch: mismatch.mismatch,
    mismatchDetail: mismatch.detail,
    warning: resolverResult.warning ?? (mismatch.mismatch ? mismatch.detail : null),
    readiness,
    lastGenerationAt,
    lastGenerationSummary,
  };
}

export function buildProviderMenuProfileHealthFromSettingsRow(
  row: ProviderSettingsMenuProfileRow,
  env: EnvLike = {},
  extras?: { lastGenerationAt?: string | null; lastGenerationSummary?: string | null },
): ProviderMenuProfileHealth {
  const resolverResult = resolveProviderMenuProfileFromSettings(
    providerSettingsRowToMenuProfileInput(row, env),
  );
  return (
    buildProviderMenuProfileHealth({
      row,
      resolverResult,
      env,
      lastGenerationAt: extras?.lastGenerationAt ?? null,
      lastGenerationSummary: extras?.lastGenerationSummary ?? null,
    }) ?? {
      providerId: row.providerId,
      resolverFlagOn: isMenuProfileResolverEnabled(env),
      profileResolved: "FAIL",
      fallbackActive: false,
      resolveSource: null,
      locale: row.locale,
      menuProfileId: row.menuProfileId,
      country: row.defaultCountryCode,
      currency: row.defaultCurrency,
      warmDishBankCount: 0,
      categoryLabelCoverage: { covered: 0, total: RUNTIME_CATEGORY_LIST.length },
      generationEnabled: false,
      generationReason: "resolver_disabled",
      localeProfileMismatch: false,
      mismatchDetail: null,
      warning: null,
      readiness: "error",
      lastGenerationAt: null,
      lastGenerationSummary: null,
    }
  );
}

export function toSuperadminMenuProfileOverviewRow(
  providerId: string,
  providerName: string,
  health: ProviderMenuProfileHealth,
): SuperadminMenuProfileOverviewRow {
  return {
    providerId,
    providerName,
    locale: health.locale,
    menuProfileId: health.menuProfileId,
    country: health.country,
    currency: health.currency,
    resolverStatus: health.resolverFlagOn ? "ON" : "OFF",
    profileResolved: health.profileResolved,
    generationEnabled: health.generationEnabled,
    warmDishBankCount: health.warmDishBankCount,
    warning: health.warning,
    mismatch: health.localeProfileMismatch,
    readiness: health.readiness,
    lastGenerationAt: health.lastGenerationAt,
    lastGenerationSummary: health.lastGenerationSummary,
  };
}

export type SuperadminMenuProfileRegistryRow = {
  profileId: string;
  profileName: string;
  market: string;
  locale: string;
  warmDishBankCount: number;
  categoryLabelCoverage: { covered: number; total: number };
};

export function buildSuperadminMenuProfileRegistryRows(): SuperadminMenuProfileRegistryRow[] {
  return MENU_PROFILE_IDS.map((profileId) => {
    const profile = getMenuProfile(profileId);
    return {
      profileId: profile.id,
      profileName: profile.name,
      market: profile.market,
      locale: profile.locale,
      warmDishBankCount: getWarmDishBankSeedsForProfile(profileId).length,
      categoryLabelCoverage: categoryLabelCoverage(profile),
    };
  });
}
