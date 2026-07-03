/**
 * Client-safe SMART-1 translation enums (no node:crypto).
 * Server hash helpers live in translationStatus.ts.
 */

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
