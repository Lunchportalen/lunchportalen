/**
 * SMART-1 — pure translation status helpers (no runtime wiring).
 * Employee overlay (SMART-3) must use isEmployeeVisibleTranslation only via server read model.
 */
import { createHash } from "node:crypto";

export const MENU_CONTENT_SOURCE_KINDS = [
  "menu_day",
  "menu_day_item",
  "category_label",
  "allergen_label",
] as const;

export type MenuContentSourceKind = (typeof MENU_CONTENT_SOURCE_KINDS)[number];

export const MENU_CONTENT_FIELDS = ["title", "description", "label"] as const;

export type MenuContentField = (typeof MENU_CONTENT_FIELDS)[number];

export const MENU_CONTENT_TRANSLATION_STATUSES = [
  "missing",
  "draft",
  "suggested",
  "approved",
  "rejected",
  "stale",
] as const;

export type MenuContentTranslationStatus = (typeof MENU_CONTENT_TRANSLATION_STATUSES)[number];

export const EMPLOYEE_VISIBLE_TRANSLATION_STATUS: MenuContentTranslationStatus = "approved";

const NON_EMPLOYEE_VISIBLE_STATUSES = new Set<MenuContentTranslationStatus>([
  "missing",
  "draft",
  "suggested",
  "rejected",
  "stale",
]);

/** Normalize provider original text before hashing (NFC + trim). */
export function normalizeOriginalTextForHash(text: string): string {
  return text.normalize("NFC").trim();
}

/** Stable hash for original_text stale detection (matches menu-profile digest style). */
export function hashOriginalText(text: string): string {
  const normalized = normalizeOriginalTextForHash(text);
  const digest = createHash("sha256").update(normalized, "utf8").digest("hex");
  return `sha256:${digest}`;
}

export function originalTextHashMatches(storedHash: string, currentOriginalText: string): boolean {
  return storedHash === hashOriginalText(currentOriginalText);
}

/**
 * Future employee overlay visibility contract (SMART-3 server read model only).
 * Requires approved status AND hash match; stale/missing/draft never visible.
 */
export function isEmployeeVisibleTranslation(
  status: MenuContentTranslationStatus,
  hashMatches: boolean,
): boolean {
  return status === EMPLOYEE_VISIBLE_TRANSLATION_STATUS && hashMatches;
}

export function isNonEmployeeVisibleStatus(status: MenuContentTranslationStatus): boolean {
  return NON_EMPLOYEE_VISIBLE_STATUSES.has(status);
}

/** Employee fallback when overlay is not visible: always original provider text from Sanity. */
export function employeeTranslationDisplayFallback(): "original_provider_text" {
  return "original_provider_text";
}
