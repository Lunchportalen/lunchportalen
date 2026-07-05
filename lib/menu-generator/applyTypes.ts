/**
 * Localized fixed menu generator — provider-controlled apply contract.
 * Draft-only writes via existing varmrett menuDay path. No order impact.
 */

import type { PlanTier } from "@/lib/cms/menuDayContract";
import type { MenuLocale } from "@/lib/menu-generator/types";
import type { MenuProfileId } from "@/lib/menu-profile/types";
import { SUPPORTED_MENU_LOCALES } from "@/lib/menu-generator/types";

export const LOCALIZED_MENU_GENERATOR_VERSION = "1.0.0";

export const APPLY_OVERWRITE_MODES = [
  "create_missing_only",
  "replace_drafts_only",
  "stop_if_any_day_exists",
  "stop_if_published_exists",
] as const;

export type ApplyOverwriteMode = (typeof APPLY_OVERWRITE_MODES)[number];

export const DEFAULT_APPLY_OVERWRITE_MODE: ApplyOverwriteMode = "stop_if_published_exists";

export type ApplyDayStatus =
  | "would_create"
  | "created"
  | "would_update_draft"
  | "updated_draft"
  | "skipped_existing"
  | "skipped_published"
  | "blocked_published"
  | "unchanged"
  | "failed";

export type ApplyExistingDayState = "missing" | "draft" | "published" | "order_locked";

export type ApplyMenuDayDiffField = {
  field: "mealTitle" | "description" | "allergens";
  before: string;
  after: string;
};

export type ApplyGeneratedVarmrettState = {
  mealTitle: string;
  description: string;
  allergensText: string;
  itemKey: string;
  slug: string;
  hotMealBaseItemKey: string | null;
  isPremiumUpgrade: boolean;
};

export type ApplyDayDiff = {
  date: string;
  weekday: string;
  status: ApplyDayStatus;
  existingState: ApplyExistingDayState;
  generatedState: ApplyGeneratedVarmrettState | null;
  diff: ApplyMenuDayDiffField[];
  warnings: string[];
  providerLabel: string;
};

export type ApplySummary = {
  createdDraftDays: number;
  updatedDraftDays: number;
  skippedExistingDays: number;
  skippedPublishedDays: number;
  blockedPublishedDays: number;
  unchangedDays: number;
  totalGeneratedDays: number;
  failedDays: number;
};

export type ApplyLocalizedGeneratedWeekMenuInput = {
  providerId: string;
  weekStart: string;
  menuLocale: MenuLocale;
  country: string;
  menuProfileId: MenuProfileId;
  packageTier: PlanTier;
  overwriteMode: ApplyOverwriteMode;
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
  generatorVersion: string;
  overwriteMode: ApplyOverwriteMode;
  idempotencyKey: string;
  summary: ApplySummary;
  days: ApplyDayDiff[];
  warnings: string[];
  blockedReasons: string[];
  audit: {
    action: string;
    dryRun: boolean;
    appliedDates: string[];
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
  packageTier: PlanTier;
  generatorVersion?: string;
}): string {
  const version = input.generatorVersion ?? LOCALIZED_MENU_GENERATOR_VERSION;
  return [
    input.providerId,
    input.weekStart,
    input.menuLocale,
    input.menuProfileId,
    input.overwriteMode,
    input.packageTier,
    version,
  ].join("|");
}
