/**
 * Localized fixed menu generator — provider-controlled full-menu apply contract.
 */

import type { PlanTier } from "@/lib/cms/menuDayContract";
import type { MenuApplyCapabilities } from "@/lib/menu-generator/applyCapabilities";
import type { FullApplyDayDiff, FullApplyCategoryDiff, FullApplySummary } from "@/lib/menu-generator/fullApplyDiff";
import type { MenuLocale } from "@/lib/menu-generator/types";
import type { MenuProfileId } from "@/lib/menu-profile/types";
import { SUPPORTED_MENU_LOCALES } from "@/lib/menu-generator/types";

export const LOCALIZED_MENU_GENERATOR_VERSION = "2.0.0";

export const APPLY_OVERWRITE_MODES = [
  "create_missing_only",
  "replace_drafts_only",
  "stop_if_any_day_exists",
  "stop_if_published_exists",
] as const;

export type ApplyOverwriteMode = (typeof APPLY_OVERWRITE_MODES)[number];

export const DEFAULT_APPLY_OVERWRITE_MODE: ApplyOverwriteMode = "stop_if_published_exists";

export const APPLY_CATEGORY_SCOPES = [
  "all_supported",
  "fixed_categories_only",
  "hotMeal_only",
] as const;

export type ApplyCategoryScope = (typeof APPLY_CATEGORY_SCOPES)[number];

export const DEFAULT_APPLY_CATEGORY_SCOPE: ApplyCategoryScope = "all_supported";

export type ApplyLocalizedGeneratedWeekMenuInput = {
  providerId: string;
  weekStart: string;
  menuLocale: MenuLocale;
  country: string;
  menuProfileId: MenuProfileId;
  packageTier: PlanTier;
  overwriteMode: ApplyOverwriteMode;
  categoryScope: ApplyCategoryScope;
  dryRun: boolean;
  idempotencyKey: string;
  providerSlug?: string | null;
};

export type ApplyLocalizedGeneratedWeekMenuResult = {
  ok: boolean;
  mode: "dry_run" | "apply";
  providerId: string;
  weekStart: string;
  menuLocale: MenuLocale;
  menuProfileId: MenuProfileId;
  categoryScope: ApplyCategoryScope;
  generatorVersion: string;
  overwriteMode: ApplyOverwriteMode;
  idempotencyKey: string;
  capabilities: MenuApplyCapabilities;
  summary: FullApplySummary;
  days: FullApplyDayDiff[];
  catalogCategories: FullApplyCategoryDiff[];
  warnings: string[];
  blockedReasons: string[];
  audit: {
    action: string;
    dryRun: boolean;
    appliedDates: string[];
    appliedCatalogCategories: string[];
    skippedDates: string[];
    errorCount: number;
  };
  errorCode?: ApplyErrorCode;
  message?: string;
};

export type ApplyErrorCode =
  | "provider_scope_denied"
  | "generator_flag_disabled"
  | "resolver_flag_disabled"
  | "unsupported_menu_locale"
  | "provider_profile_missing"
  | "published_days_exist"
  | "schema_mapping_failed"
  | "unsupported_category_scope"
  | "unsupported_category_schema"
  | "sanity_write_failed"
  | "idempotency_conflict"
  | "validation_failed";

export function isSupportedApplyMenuLocale(value: string): value is MenuLocale {
  return (SUPPORTED_MENU_LOCALES as readonly string[]).includes(value);
}

export function buildApplyIdempotencyKey(input: {
  providerId: string;
  weekStart: string;
  menuLocale: MenuLocale;
  menuProfileId: MenuProfileId;
  overwriteMode: ApplyOverwriteMode;
  categoryScope: ApplyCategoryScope;
  packageTier: PlanTier;
  generatorVersion?: string;
}): string {
  const version = input.generatorVersion ?? LOCALIZED_MENU_GENERATOR_VERSION;
  return [
    input.providerId,
    input.weekStart,
    input.menuLocale,
    input.menuProfileId,
    input.categoryScope,
    input.overwriteMode,
    input.packageTier,
    version,
  ].join("|");
}
