/**
 * G5d.3c — Pure validation helpers for mapping draft persistence.
 *
 * No DB, Supabase, React, API, Sanity, billing, order, week, or publish imports.
 * Prepares for G5d.3d API — not wired to runtime.
 */

import { WARM_DISH_PREVIEW_ID_PREFIX } from "@/lib/menu-profile/runtimeMapping";
import { MENU_PROFILE_IDS, type MenuProfileId } from "@/lib/menu-profile/types";
import type {
  RuntimeMappingDraftStatus,
  RuntimeMappingDraftValidationError,
  RuntimeMappingDraftValidationInput,
  RuntimeMappingDraftValidationResult,
} from "@/lib/menu-profile/runtimeMappingDraftValidationTypes";

export type {
  NormalizedRuntimeMappingDraftInput,
  RuntimeMappingDraftStatus,
  RuntimeMappingDraftValidationError,
  RuntimeMappingDraftValidationErrorCode,
  RuntimeMappingDraftValidationInput,
  RuntimeMappingDraftValidationResult,
} from "@/lib/menu-profile/runtimeMappingDraftValidationTypes";

const DRAFT_STATUSES: readonly RuntimeMappingDraftStatus[] = ["draft", "reviewed", "archived"];

const PROFILE_KEYS_FORBIDDEN_IN_ORDER_CHOICE = [
  "panini",
  "insalata",
  "primo_del_giorno",
  "piatto_freddo",
  "belegte_broetchen",
  "warme_mahlzeit",
  "vegetarische_option",
] as const;

const ORDER_CHOICE_FIELD_NAMES = [
  "runtimeOrderChoiceKey",
  "orderChoiceKey",
  "choiceKey",
  "runtime_order_choice_key",
  "order_choice_key",
] as const;

const PRICE_CURRENCY_MUTATION_FIELDS = [
  "price",
  "cost",
  "margin",
  "commission",
  "provisjon",
  "vat",
  "mva",
  "currencyOverride",
  ["provider_price", "_rules"].join(""),
  "pricePreview",
] as const;

const PROVIDER_OWNED_MUTATION_FIELDS = [
  "catalogTitleOverride",
  "itemTitleOverride",
  "mealTitleOverride",
  "allergenOverride",
  "companyNameOverride",
  "customerNameOverride",
] as const;

const SANITY_FIELD_NAMES = ["sanityDocumentId", "sanityId", "sanityDocumentRef"] as const;

const SHADOW_ONLY_CATEGORY_STATUSES = new Set([
  "shadow_only_non_no",
  "presentation_only",
  "unsupported",
]);

function err(
  code: RuntimeMappingDraftValidationError["code"],
  path: string,
  message: string,
): RuntimeMappingDraftValidationError {
  return { code, path, message };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isForbiddenTruthyFlag(value: unknown): boolean {
  return value === true;
}

export function validateMenuProfileId(profileId: string): RuntimeMappingDraftValidationError[] {
  if (!MENU_PROFILE_IDS.includes(profileId as MenuProfileId)) {
    return [
      err(
        "invalid_menu_profile_id",
        "menuProfileId",
        `menu_profile_id must be one of ${MENU_PROFILE_IDS.join(", ")}`,
      ),
    ];
  }
  return [];
}

export function validateDraftStatus(
  status: string,
  archivedAt?: string | null,
): RuntimeMappingDraftValidationError[] {
  const errors: RuntimeMappingDraftValidationError[] = [];

  if (!DRAFT_STATUSES.includes(status as RuntimeMappingDraftStatus)) {
    errors.push(
      err(
        "invalid_draft_status",
        "draftStatus",
        `draft_status must be one of ${DRAFT_STATUSES.join(", ")}`,
      ),
    );
    return errors;
  }

  if (status === "archived") {
    if (!archivedAt) {
      errors.push(
        err(
          "archived_requires_archived_at",
          "archivedAt",
          "archived draft_status requires archived_at",
        ),
      );
    }
  } else if (archivedAt) {
    errors.push(
      err(
        "non_archived_must_not_have_archived_at",
        "archivedAt",
        "non-archived draft_status must not have archived_at",
      ),
    );
  }

  return errors;
}

export function validateMappingJsonShape(mappingJson: unknown): RuntimeMappingDraftValidationError[] {
  if (!isPlainObject(mappingJson)) {
    return [
      err("mapping_json_not_object", "mappingJson", "mapping_json must be a JSON object"),
    ];
  }
  return [];
}

export function validateNoRuntimeEnablement(
  mappingJson: unknown,
): RuntimeMappingDraftValidationError[] {
  if (!isPlainObject(mappingJson)) return [];

  const errors: RuntimeMappingDraftValidationError[] = [];

  if (mappingJson.isRuntimeEnabled === true) {
    errors.push(
      err(
        "runtime_enabled_not_allowed",
        "mappingJson.isRuntimeEnabled",
        "isRuntimeEnabled must remain false for shadow-only drafts",
      ),
    );
  }

  if (mappingJson.isShadowOnly === false) {
    errors.push(
      err(
        "runtime_enabled_not_allowed",
        "mappingJson.isShadowOnly",
        "isShadowOnly must remain true for shadow-only drafts",
      ),
    );
  }

  const summary = mappingJson.summary;
  if (isPlainObject(summary)) {
    if (typeof summary.runtimeEnabledCount === "number" && summary.runtimeEnabledCount !== 0) {
      errors.push(
        err(
          "runtime_enabled_not_allowed",
          "mappingJson.summary.runtimeEnabledCount",
          "summary.runtimeEnabledCount must remain 0",
        ),
      );
    }
  }

  return errors;
}

export function validateNoPublishOrderSaveFlags(
  mappingJson: unknown,
): RuntimeMappingDraftValidationError[] {
  if (!isPlainObject(mappingJson)) return [];

  const errors: RuntimeMappingDraftValidationError[] = [];

  const summary = mappingJson.summary;
  if (isPlainObject(summary)) {
    if (typeof summary.canSaveCount === "number" && summary.canSaveCount !== 0) {
      errors.push(
        err(
          "can_save_not_allowed",
          "mappingJson.summary.canSaveCount",
          "summary.canSaveCount must remain 0",
        ),
      );
    }
    if (typeof summary.canPublishCount === "number" && summary.canPublishCount !== 0) {
      errors.push(
        err(
          "can_publish_not_allowed",
          "mappingJson.summary.canPublishCount",
          "summary.canPublishCount must remain 0",
        ),
      );
    }
    if (typeof summary.canOrderCount === "number" && summary.canOrderCount !== 0) {
      errors.push(
        err(
          "can_order_not_allowed",
          "mappingJson.summary.canOrderCount",
          "summary.canOrderCount must remain 0",
        ),
      );
    }
  }

  const categories = mappingJson.categories;
  if (Array.isArray(categories)) {
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      if (!isPlainObject(category)) continue;
      const base = `mappingJson.categories[${i}]`;
      const profileKey = String(category.profileCategoryKey ?? i);

      if (isForbiddenTruthyFlag(category.canSaveToMenuDay)) {
        errors.push(
          err(
            "can_save_not_allowed",
            `${base}.canSaveToMenuDay`,
            `Category ${profileKey}: canSaveToMenuDay must remain false`,
          ),
        );
      }
      if (isForbiddenTruthyFlag(category.canSaveToCatalog)) {
        errors.push(
          err(
            "can_save_not_allowed",
            `${base}.canSaveToCatalog`,
            `Category ${profileKey}: canSaveToCatalog must remain false`,
          ),
        );
      }
      if (isForbiddenTruthyFlag(category.canPublish)) {
        errors.push(
          err(
            "can_publish_not_allowed",
            `${base}.canPublish`,
            `Category ${profileKey}: canPublish must remain false`,
          ),
        );
      }
      if (isForbiddenTruthyFlag(category.canOrder)) {
        errors.push(
          err(
            "can_order_not_allowed",
            `${base}.canOrder`,
            `Category ${profileKey}: canOrder must remain false`,
          ),
        );
      }

      if (category.profileCategoryKey === "enterprise_upgrade" && category.canOrder === true) {
        errors.push(
          err(
            "can_order_not_allowed",
            `${base}.canOrder`,
            "enterprise_upgrade category must not be orderable",
          ),
        );
      }

      const status = category.status;
      const hasRuntimeCategoryKey =
        category.runtimeCategoryKey !== null && category.runtimeCategoryKey !== undefined;
      const hasRuntimeOrderChoiceKey =
        category.runtimeOrderChoiceKey !== null && category.runtimeOrderChoiceKey !== undefined;
      if (
        typeof status === "string" &&
        SHADOW_ONLY_CATEGORY_STATUSES.has(status) &&
        (hasRuntimeCategoryKey || hasRuntimeOrderChoiceKey)
      ) {
        errors.push(
          err(
            "unknown_profile_key_requires_shadow",
            base,
            `Category ${profileKey} with status ${status} must have null runtime keys`,
          ),
        );
      }
    }
  }

  return errors;
}

export function validateNoEmployeeVisibility(
  mappingJson: unknown,
): RuntimeMappingDraftValidationError[] {
  const errors: RuntimeMappingDraftValidationError[] = [];

  function walk(value: unknown, path: string): void {
    if (!isPlainObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (key === "employeeVisible" || key === "visibleToEmployees") {
        if (isForbiddenTruthyFlag(child)) {
          errors.push(
            err(
              "employee_visible_not_allowed",
              childPath,
              `${key} must remain false for shadow-only drafts`,
            ),
          );
        }
      }
      walk(child, childPath);
    }
  }

  walk(mappingJson, "mappingJson");
  return errors;
}

export function validateNoPublishOrderActivationFlags(
  mappingJson: unknown,
): RuntimeMappingDraftValidationError[] {
  const errors: RuntimeMappingDraftValidationError[] = [];

  function walk(value: unknown, path: string): void {
    if (!isPlainObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (key === "publishEnabled" && isForbiddenTruthyFlag(child)) {
        errors.push(
          err(
            "publish_enabled_not_allowed",
            childPath,
            "publishEnabled must remain false for shadow-only drafts",
          ),
        );
      }
      if (key === "orderEnabled" && isForbiddenTruthyFlag(child)) {
        errors.push(
          err(
            "order_enabled_not_allowed",
            childPath,
            "orderEnabled must remain false for shadow-only drafts",
          ),
        );
      }
      walk(child, childPath);
    }
  }

  walk(mappingJson, "mappingJson");
  return errors;
}

export function validateNoSanityWriteFields(
  mappingJson: unknown,
): RuntimeMappingDraftValidationError[] {
  const errors: RuntimeMappingDraftValidationError[] = [];

  function walk(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (!isPlainObject(value)) return;

    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;

      if ((SANITY_FIELD_NAMES as readonly string[]).includes(key)) {
        if (child !== null && child !== undefined && child !== "") {
          errors.push(
            err(
              "sanity_document_id_not_allowed",
              childPath,
              `${key} must not be present in shadow-only mapping drafts`,
            ),
          );
        }
      }

      if (
        typeof child === "string" &&
        child.startsWith(WARM_DISH_PREVIEW_ID_PREFIX) &&
        (SANITY_FIELD_NAMES as readonly string[]).includes(key)
      ) {
        errors.push(
          err(
            "warm_dish_preview_sanity_id_not_allowed",
            childPath,
            "warm-dish-preview IDs must not be used as Sanity document references",
          ),
        );
      }

      walk(child, childPath);
    }
  }

  walk(mappingJson, "mappingJson");

  for (const sanityField of SANITY_FIELD_NAMES) {
    walkForWarmDishAsSanityId(mappingJson, "mappingJson", sanityField, errors);
  }

  return errors;
}

function walkForWarmDishAsSanityId(
  value: unknown,
  path: string,
  fieldName: string,
  errors: RuntimeMappingDraftValidationError[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walkForWarmDishAsSanityId(item, `${path}[${index}]`, fieldName, errors),
    );
    return;
  }
  if (!isPlainObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (
      key === fieldName &&
      typeof child === "string" &&
      child.startsWith(WARM_DISH_PREVIEW_ID_PREFIX)
    ) {
      errors.push(
        err(
          "warm_dish_preview_sanity_id_not_allowed",
          childPath,
          "warm-dish-preview IDs must not be used as Sanity document references",
        ),
      );
    }
    walkForWarmDishAsSanityId(child, childPath, fieldName, errors);
  }
}

export function validateNoPriceCurrencyMutation(
  mappingJson: unknown,
): RuntimeMappingDraftValidationError[] {
  const errors: RuntimeMappingDraftValidationError[] = [];

  function walk(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (!isPlainObject(value)) return;

    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if ((PRICE_CURRENCY_MUTATION_FIELDS as readonly string[]).includes(key)) {
        if (child !== null && child !== undefined) {
          errors.push(
            err(
              "price_or_currency_mutation_not_allowed",
              childPath,
              `${key} must not be present in shadow-only mapping drafts`,
            ),
          );
        }
      }
      walk(child, childPath);
    }
  }

  walk(mappingJson, "mappingJson");
  return errors;
}

export function validateNoProviderOwnedDataMutation(
  mappingJson: unknown,
): RuntimeMappingDraftValidationError[] {
  const errors: RuntimeMappingDraftValidationError[] = [];

  function walk(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (!isPlainObject(value)) return;

    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if ((PROVIDER_OWNED_MUTATION_FIELDS as readonly string[]).includes(key)) {
        if (child !== null && child !== undefined && child !== "") {
          errors.push(
            err(
              "provider_owned_title_mutation_not_allowed",
              childPath,
              `${key} must not be present in shadow-only mapping drafts`,
            ),
          );
        }
      }
      walk(child, childPath);
    }
  }

  walk(mappingJson, "mappingJson");
  return errors;
}

export function validateProfileKeysInOrderChoiceFields(
  mappingJson: unknown,
): RuntimeMappingDraftValidationError[] {
  const errors: RuntimeMappingDraftValidationError[] = [];

  function walk(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (!isPlainObject(value)) return;

    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (
        (ORDER_CHOICE_FIELD_NAMES as readonly string[]).includes(key) &&
        typeof child === "string" &&
        (PROFILE_KEYS_FORBIDDEN_IN_ORDER_CHOICE as readonly string[]).includes(child)
      ) {
        errors.push(
          err(
            "profile_key_in_order_choice_not_allowed",
            childPath,
            `Profile key "${child}" must not appear in order choice fields`,
          ),
        );
      }
      walk(child, childPath);
    }
  }

  walk(mappingJson, "mappingJson");
  return errors;
}

export function validateWarmDishPreviewJson(
  items: unknown,
): RuntimeMappingDraftValidationError[] {
  if (!Array.isArray(items)) {
    return [
      err(
        "warm_dish_preview_not_array",
        "warmDishPreviewJson",
        "warm_dish_preview_json must be a JSON array",
      ),
    ];
  }

  const errors: RuntimeMappingDraftValidationError[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!isPlainObject(item)) continue;
    const base = `warmDishPreviewJson[${i}]`;

    if (isForbiddenTruthyFlag(item.canApplyToMenu)) {
      errors.push(
        err(
          "can_publish_not_allowed",
          `${base}.canApplyToMenu`,
          "canApplyToMenu must remain false for warm dish preview entries",
        ),
      );
    }
    if (isForbiddenTruthyFlag(item.canPublish)) {
      errors.push(
        err(
          "can_publish_not_allowed",
          `${base}.canPublish`,
          "canPublish must remain false for warm dish preview entries",
        ),
      );
    }
    if (isForbiddenTruthyFlag(item.canOrder)) {
      errors.push(
        err(
          "can_order_not_allowed",
          `${base}.canOrder`,
          "canOrder must remain false for warm dish preview entries",
        ),
      );
    }
    if (item.isPreviewOnly === false) {
      errors.push(
        err(
          "runtime_enabled_not_allowed",
          `${base}.isPreviewOnly`,
          "isPreviewOnly must remain true for warm dish preview entries",
        ),
      );
    }
  }

  return errors;
}

function validateUnmappedCategoriesJson(
  value: unknown,
): RuntimeMappingDraftValidationError[] {
  if (!Array.isArray(value)) {
    return [
      err(
        "unmapped_categories_not_array",
        "unmappedCategoriesJson",
        "unmapped_categories_json must be a JSON array",
      ),
    ];
  }
  return [];
}

function validateValidationSummaryJson(
  value: unknown,
): RuntimeMappingDraftValidationError[] {
  if (!isPlainObject(value)) {
    return [
      err(
        "validation_summary_not_object",
        "validationSummaryJson",
        "validation_summary_json must be a JSON object",
      ),
    ];
  }
  return [];
}

function validateWarmDishFlagsInMappingJson(
  mappingJson: unknown,
): RuntimeMappingDraftValidationError[] {
  if (!isPlainObject(mappingJson)) return [];

  const warmDishes = mappingJson.warmDishPreview;
  if (!Array.isArray(warmDishes)) return [];

  const errors: RuntimeMappingDraftValidationError[] = [];
  for (let i = 0; i < warmDishes.length; i++) {
    const item = warmDishes[i];
    if (!isPlainObject(item)) continue;
    const base = `mappingJson.warmDishPreview[${i}]`;

    if (isForbiddenTruthyFlag(item.canApplyToMenu)) {
      errors.push(
        err(
          "can_publish_not_allowed",
          `${base}.canApplyToMenu`,
          "canApplyToMenu must remain false",
        ),
      );
    }
    if (isForbiddenTruthyFlag(item.canPublish)) {
      errors.push(
        err(
          "can_publish_not_allowed",
          `${base}.canPublish`,
          "canPublish must remain false",
        ),
      );
    }
    if (isForbiddenTruthyFlag(item.canOrder)) {
      errors.push(
        err(
          "can_order_not_allowed",
          `${base}.canOrder`,
          "canOrder must remain false",
        ),
      );
    }
    if (item.isPreviewOnly === false) {
      errors.push(
        err(
          "runtime_enabled_not_allowed",
          `${base}.isPreviewOnly`,
          "isPreviewOnly must remain true",
        ),
      );
    }
  }
  return errors;
}

export function normalizeRuntimeMappingDraftInput(
  input: RuntimeMappingDraftValidationInput,
): RuntimeMappingDraftValidationInput {
  return {
    ...input,
    menuProfileId: input.menuProfileId.trim(),
    mappingVersion: input.mappingVersion.trim(),
    sourceProfileVersion: input.sourceProfileVersion?.trim() ?? input.sourceProfileVersion,
    notes: input.notes?.trim() ?? input.notes,
  };
}

export function validateRuntimeMappingDraft(
  input: RuntimeMappingDraftValidationInput,
): RuntimeMappingDraftValidationResult {
  const normalized = normalizeRuntimeMappingDraftInput(input);
  const errors: RuntimeMappingDraftValidationError[] = [];

  errors.push(...validateMenuProfileId(normalized.menuProfileId));
  errors.push(...validateDraftStatus(normalized.draftStatus, normalized.archivedAt));
  errors.push(...validateMappingJsonShape(normalized.mappingJson));
  errors.push(...validateUnmappedCategoriesJson(normalized.unmappedCategoriesJson));
  errors.push(...validateWarmDishPreviewJson(normalized.warmDishPreviewJson));
  errors.push(...validateValidationSummaryJson(normalized.validationSummaryJson));

  errors.push(...validateNoRuntimeEnablement(normalized.mappingJson));
  errors.push(...validateNoPublishOrderSaveFlags(normalized.mappingJson));
  errors.push(...validateWarmDishFlagsInMappingJson(normalized.mappingJson));
  errors.push(...validateNoEmployeeVisibility(normalized.mappingJson));
  errors.push(...validateNoPublishOrderActivationFlags(normalized.mappingJson));
  errors.push(...validateNoSanityWriteFields(normalized.mappingJson));
  errors.push(...validateNoPriceCurrencyMutation(normalized.mappingJson));
  errors.push(...validateNoProviderOwnedDataMutation(normalized.mappingJson));
  errors.push(...validateProfileKeysInOrderChoiceFields(normalized.mappingJson));

  errors.push(...validateNoPriceCurrencyMutation(normalized.warmDishPreviewJson));
  errors.push(...validateNoProviderOwnedDataMutation(normalized.warmDishPreviewJson));
  errors.push(...validateNoSanityWriteFields(normalized.warmDishPreviewJson));
  errors.push(...validateProfileKeysInOrderChoiceFields(normalized.warmDishPreviewJson));

  const ok = errors.length === 0;

  return {
    ok,
    errors,
    warnings: [],
    normalized: ok ? normalized : undefined,
  };
}

export function assertValidRuntimeMappingDraft(input: RuntimeMappingDraftValidationInput): void {
  const result = validateRuntimeMappingDraft(input);
  if (!result.ok) {
    const summary = result.errors.map((e) => `${e.code}@${e.path}: ${e.message}`).join("; ");
    throw new Error(`Invalid runtime mapping draft: ${summary}`);
  }
}
