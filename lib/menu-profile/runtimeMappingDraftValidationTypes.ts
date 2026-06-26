/**
 * G5d.3c — Runtime mapping draft validation types (pure, no I/O).
 */

import type { MenuProfileId } from "@/lib/menu-profile/types";

export type RuntimeMappingDraftStatus = "draft" | "reviewed" | "archived";

export type RuntimeMappingDraftValidationErrorCode =
  | "invalid_menu_profile_id"
  | "invalid_draft_status"
  | "mapping_json_not_object"
  | "unmapped_categories_not_array"
  | "warm_dish_preview_not_array"
  | "validation_summary_not_object"
  | "runtime_enabled_not_allowed"
  | "can_save_not_allowed"
  | "can_publish_not_allowed"
  | "can_order_not_allowed"
  | "employee_visible_not_allowed"
  | "publish_enabled_not_allowed"
  | "order_enabled_not_allowed"
  | "sanity_document_id_not_allowed"
  | "warm_dish_preview_sanity_id_not_allowed"
  | "profile_key_in_order_choice_not_allowed"
  | "price_or_currency_mutation_not_allowed"
  | "provider_owned_title_mutation_not_allowed"
  | "unknown_profile_key_requires_shadow"
  | "archived_requires_archived_at"
  | "non_archived_must_not_have_archived_at";

export type RuntimeMappingDraftValidationError = {
  code: RuntimeMappingDraftValidationErrorCode;
  path: string;
  message: string;
};

export type RuntimeMappingDraftValidationInput = {
  providerId: string;
  menuProfileId: string;
  mappingVersion: string;
  sourceProfileVersion?: string | null;
  draftStatus: RuntimeMappingDraftStatus;
  mappingJson: unknown;
  unmappedCategoriesJson: unknown;
  warmDishPreviewJson: unknown;
  validationSummaryJson: unknown;
  notes?: string | null;
  archivedAt?: string | null;
};

export type RuntimeMappingDraftValidationResult = {
  ok: boolean;
  errors: RuntimeMappingDraftValidationError[];
  warnings: string[];
  normalized?: RuntimeMappingDraftValidationInput;
};

export type NormalizedRuntimeMappingDraftInput = RuntimeMappingDraftValidationInput & {
  menuProfileId: MenuProfileId;
};
