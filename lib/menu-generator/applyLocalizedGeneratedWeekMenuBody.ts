/**
 * Request body parsing for localized generator apply (client-safe).
 */

import type { PlanTier } from "@/lib/cms/menuDayContract";
import {
  DEFAULT_APPLY_CATEGORY_SCOPE,
  DEFAULT_APPLY_OVERWRITE_MODE,
  type ApplyCategoryScope,
  type ApplyErrorCode,
  type ApplyLocalizedGeneratedWeekMenuInput,
  type ApplyOverwriteMode,
} from "@/lib/menu-generator/applyTypes";

function parseOverwriteMode(raw: unknown): ApplyOverwriteMode {
  const value = String(raw ?? "").trim();
  if (
    value === "create_missing_only_strict" ||
    value === "create_future_menu_days_only" ||
    value === "create_missing_only" ||
    value === "replace_catalog_with_confirmation" ||
    value === "replace_drafts_only" ||
    value === "stop_if_any_day_exists" ||
    value === "stop_if_published_exists"
  ) {
    return value;
  }
  return DEFAULT_APPLY_OVERWRITE_MODE;
}

function parseCategoryScope(raw: unknown): ApplyCategoryScope {
  const value = String(raw ?? "").trim();
  if (value === "all_supported" || value === "fixed_categories_only" || value === "hotMeal_only") {
    return value;
  }
  return DEFAULT_APPLY_CATEGORY_SCOPE;
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

  const categoryScope = parseCategoryScope(o.categoryScope);
  if (categoryScope === "hotMeal_only") {
    return {
      ok: false,
      errorCode: "unsupported_category_scope",
      message: "hotMeal_only er debug/fallback — bruk all_supported.",
    };
  }

  return {
    ok: true,
    input: {
      weekStart,
      packageTier: packageTier as PlanTier,
      overwriteMode: parseOverwriteMode(o.overwriteMode),
      categoryScope,
      dryRun: o.dryRun !== false && o.dryRun !== "false",
      idempotencyKey: String(o.idempotencyKey ?? "").trim(),
      catalogUpdateConfirmationToken: String(o.catalogUpdateConfirmationToken ?? "").trim() || null,
      replaceCatalogConfirmationPhrase: String(o.replaceCatalogConfirmationPhrase ?? "").trim() || null,
    },
  };
}
