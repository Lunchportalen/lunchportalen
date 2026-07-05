/**
 * Catalog apply safety — strict modes and replace-with-confirmation tokens.
 */

import { createHash } from "node:crypto";

import type { FullApplyCategoryDiff } from "@/lib/menu-generator/fullApplyDiff";
import type { ApplyErrorCode, ApplyOverwriteMode } from "@/lib/menu-generator/applyTypes";

export const CATALOG_REPLACE_CONFIRMATION_PHRASE =
  "Jeg forstår at dette oppdaterer eksisterende katalogvalg";

export function isStrictCatalogOverwriteMode(mode: ApplyOverwriteMode): boolean {
  return mode === "create_missing_only_strict";
}

export function isFutureMenuDaysOnlyMode(mode: ApplyOverwriteMode): boolean {
  return mode === "create_future_menu_days_only";
}

export function isReplaceCatalogWithConfirmationMode(mode: ApplyOverwriteMode): boolean {
  return mode === "replace_catalog_with_confirmation";
}

export function catalogOverwriteSkipsAllCategories(mode: ApplyOverwriteMode): boolean {
  return mode === "create_future_menu_days_only";
}

export function isCreateMissingDayMode(mode: ApplyOverwriteMode): boolean {
  return (
    mode === "create_missing_only" ||
    mode === "create_missing_only_strict" ||
    mode === "create_future_menu_days_only"
  );
}

export function buildCatalogUpdateConfirmationToken(idempotencyKey: string): string {
  return createHash("sha256")
    .update(`lp-catalog-update:${idempotencyKey.trim()}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyCatalogUpdateConfirmationToken(
  idempotencyKey: string,
  token: string | null | undefined,
): boolean {
  const expected = buildCatalogUpdateConfirmationToken(idempotencyKey);
  const supplied = String(token ?? "").trim();
  return supplied.length > 0 && supplied === expected;
}

export function catalogDiffWouldUpdateExisting(
  catalogCategories: readonly FullApplyCategoryDiff[],
): boolean {
  return catalogCategories.some(
    (c) => c.status === "would_update_category" || c.status === "would_replace_draft_category",
  );
}

export function enforceCatalogUpdatePolicy(input: {
  overwriteMode: ApplyOverwriteMode;
  catalogUpdateConfirmationToken?: string | null;
  replaceCatalogConfirmationPhrase?: string | null;
  idempotencyKey: string;
  catalogWouldUpdate: boolean;
}): { errorCode: ApplyErrorCode; message: string } | null {
  if (!input.catalogWouldUpdate) return null;

  if (isStrictCatalogOverwriteMode(input.overwriteMode) || isFutureMenuDaysOnlyMode(input.overwriteMode)) {
    return {
      errorCode: "catalog_update_requires_confirmation",
      message: "Eksisterende katalogvalg kan ikke oppdateres i trygg modus.",
    };
  }

  if (isReplaceCatalogWithConfirmationMode(input.overwriteMode)) {
    if (input.replaceCatalogConfirmationPhrase !== CATALOG_REPLACE_CONFIRMATION_PHRASE) {
      return {
        errorCode: "catalog_update_requires_confirmation",
        message: "Bekreftelsestekst mangler eller er feil for katalogoppdatering.",
      };
    }
    if (!verifyCatalogUpdateConfirmationToken(input.idempotencyKey, input.catalogUpdateConfirmationToken)) {
      return {
        errorCode: "catalog_update_requires_confirmation",
        message: "Bekreftelsestoken matcher ikke forhåndsvisningen. Kjør forhåndsvisning på nytt.",
      };
    }
    return null;
  }

  return null;
}
