/**
 * SMART-1 — pure translation status helpers (no runtime wiring).
 * Employee overlay (SMART-3) must use isEmployeeVisibleTranslation only via server read model.
 */
import { createHash } from "node:crypto";

export {
  EMPLOYEE_VISIBLE_TRANSLATION_STATUS,
  MENU_CONTENT_FIELDS,
  MENU_CONTENT_SOURCE_KINDS,
  MENU_CONTENT_TRANSLATION_STATUSES,
  type MenuContentField,
  type MenuContentSourceKind,
  type MenuContentTranslationStatus,
} from "@/lib/smart-menu/translationStatusConstants";

import {
  EMPLOYEE_VISIBLE_TRANSLATION_STATUS,
  MENU_CONTENT_TRANSLATION_STATUSES,
  type MenuContentTranslationStatus,
} from "@/lib/smart-menu/translationStatusConstants";

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
