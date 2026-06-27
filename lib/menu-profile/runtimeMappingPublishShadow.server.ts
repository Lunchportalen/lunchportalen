/**
 * G5d.4c — Pure publish shadow evaluation helper (read-only, non-mutating).
 *
 * No DB, Supabase, Sanity, publish, order, week, or billing imports.
 * Not wired to API/UI until G5d.4d+.
 */

import "server-only";

import {
  assertValidRuntimeMappingDraft,
  validateRuntimeMappingDraft,
} from "@/lib/menu-profile/runtimeMappingDraftValidation";
import type { RuntimeMappingDraftValidationInput } from "@/lib/menu-profile/runtimeMappingDraftValidationTypes";
import {
  PUBLISH_SHADOW_BASE_BLOCKED_REASONS,
  PUBLISH_SHADOW_FORBIDDEN_DTO_FIELDS,
  ZERO_PUBLISH_SHADOW_IMPACT,
  type PublishShadowEvaluationDto,
  type PublishShadowInputValidationError,
  type PublishShadowWarmDishPreviewSummary,
  type PublishShadowWouldMapCategory,
  type RuntimeMappingPublishShadowInput,
} from "@/lib/menu-profile/runtimeMappingPublishShadowTypes";

/** Internal placeholder for G5d.3c validation — never exposed in shadow DTO. */
const SHADOW_DRAFT_VALIDATION_PROVIDER_PLACEHOLDER = "00000000-0000-0000-0000-000000000000";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function resolveEvaluatedAt(input: RuntimeMappingPublishShadowInput): string {
  if (input.evaluatedAt instanceof Date) {
    return input.evaluatedAt.toISOString();
  }
  if (typeof input.evaluatedAt === "string" && input.evaluatedAt.trim()) {
    return input.evaluatedAt.trim();
  }
  return new Date().toISOString();
}

export function validatePublishShadowInput(
  input: RuntimeMappingPublishShadowInput,
): PublishShadowInputValidationError[] {
  const errors: PublishShadowInputValidationError[] = [];

  if (!isNonEmptyString(input.draftId)) {
    errors.push({ path: "draftId", message: "draftId must be a non-empty string" });
  }
  if (!isNonEmptyString(input.menuProfileId)) {
    errors.push({ path: "menuProfileId", message: "menuProfileId must be a non-empty string" });
  }
  if (!isNonEmptyString(input.mappingVersion)) {
    errors.push({ path: "mappingVersion", message: "mappingVersion must be a non-empty string" });
  }
  if (!isPlainObject(input.mappingJson)) {
    errors.push({ path: "mappingJson", message: "mappingJson must be a JSON object" });
  }
  if (!Array.isArray(input.unmappedCategoriesJson)) {
    errors.push({
      path: "unmappedCategoriesJson",
      message: "unmappedCategoriesJson must be a JSON array",
    });
  }
  if (!Array.isArray(input.warmDishPreviewJson)) {
    errors.push({
      path: "warmDishPreviewJson",
      message: "warmDishPreviewJson must be a JSON array",
    });
  }
  if (!isPlainObject(input.validationSummaryJson)) {
    errors.push({
      path: "validationSummaryJson",
      message: "validationSummaryJson must be a JSON object",
    });
  }

  return errors;
}

export function extractWouldMapCategories(mappingJson: unknown): PublishShadowWouldMapCategory[] {
  if (!isPlainObject(mappingJson)) return [];

  const categories = mappingJson.categories;
  if (!Array.isArray(categories)) return [];

  const mapped: PublishShadowWouldMapCategory[] = [];

  for (const category of categories) {
    if (!isPlainObject(category)) continue;

    const entry: PublishShadowWouldMapCategory = {
      profileCategoryKey: String(category.profileCategoryKey ?? ""),
      status: String(category.status ?? "unknown"),
    };

    if (category.runtimeCategoryKey !== null && category.runtimeCategoryKey !== undefined) {
      entry.runtimeCategoryKey =
        category.runtimeCategoryKey === null ? null : String(category.runtimeCategoryKey);
    }
    if (category.runtimeLunchCategoryKey !== null && category.runtimeLunchCategoryKey !== undefined) {
      entry.runtimeLunchCategoryKey =
        category.runtimeLunchCategoryKey === null ? null : String(category.runtimeLunchCategoryKey);
    }
    if (category.runtimeOrderChoiceKey !== null && category.runtimeOrderChoiceKey !== undefined) {
      entry.runtimeOrderChoiceKey =
        category.runtimeOrderChoiceKey === null ? null : String(category.runtimeOrderChoiceKey);
    }

    mapped.push(entry);
  }

  return mapped;
}

export function extractUnmappedCategories(unmappedCategoriesJson: unknown): string[] {
  if (!Array.isArray(unmappedCategoriesJson)) return [];
  return unmappedCategoriesJson.map((value) => String(value));
}

export function summarizeWarmDishPreview(
  warmDishPreviewJson: unknown,
): PublishShadowWarmDishPreviewSummary {
  const count = Array.isArray(warmDishPreviewJson) ? warmDishPreviewJson.length : 0;
  return { count, previewOnly: true };
}

export function buildBlockedRuntimeActivationReasons(
  validationSummaryJson: unknown,
  _mappingJson: unknown,
): string[] {
  const reasons: string[] = [...PUBLISH_SHADOW_BASE_BLOCKED_REASONS];

  if (isPlainObject(validationSummaryJson)) {
    const extra = validationSummaryJson.blockedReasons;
    if (Array.isArray(extra)) {
      for (const item of extra) {
        if (typeof item === "string" && !reasons.includes(item)) {
          reasons.push(item);
        }
      }
    }
  }

  return reasons;
}

export function assertValidPublishShadowEvaluation(dto: PublishShadowEvaluationDto): void {
  if (dto.shadowOnly !== true) {
    throw new Error("Publish shadow evaluation must have shadowOnly: true");
  }

  const impact = dto.publishImpact;
  if (impact.runtimeWrites !== 0) {
    throw new Error("publishImpact.runtimeWrites must remain 0 for shadow evaluation");
  }
  if (impact.sanityWrites !== 0) {
    throw new Error("publishImpact.sanityWrites must remain 0 for shadow evaluation");
  }
  if (impact.orderChanges !== 0) {
    throw new Error("publishImpact.orderChanges must remain 0 for shadow evaluation");
  }
  if (impact.weekChanges !== 0) {
    throw new Error("publishImpact.weekChanges must remain 0 for shadow evaluation");
  }
  if (impact.employeeVisibleChanges !== 0) {
    throw new Error("publishImpact.employeeVisibleChanges must remain 0 for shadow evaluation");
  }

  if (dto.comparisonToCurrentPublish.currentPublishUnchanged !== true) {
    throw new Error("comparisonToCurrentPublish.currentPublishUnchanged must remain true");
  }

  if (dto.warmDishPreviewSummary.previewOnly !== true) {
    throw new Error("warmDishPreviewSummary.previewOnly must remain true");
  }

  for (const forbidden of PUBLISH_SHADOW_FORBIDDEN_DTO_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(dto, forbidden)) {
      throw new Error(`Publish shadow DTO must not include forbidden field: ${forbidden}`);
    }
  }
}

function toDraftValidationInput(
  input: RuntimeMappingPublishShadowInput,
): RuntimeMappingDraftValidationInput {
  return {
    providerId: SHADOW_DRAFT_VALIDATION_PROVIDER_PLACEHOLDER,
    menuProfileId: input.menuProfileId.trim(),
    mappingVersion: input.mappingVersion.trim(),
    sourceProfileVersion: input.sourceProfileVersion ?? null,
    draftStatus: input.draftStatus ?? "draft",
    mappingJson: input.mappingJson,
    unmappedCategoriesJson: input.unmappedCategoriesJson,
    warmDishPreviewJson: input.warmDishPreviewJson,
    validationSummaryJson: input.validationSummaryJson,
    notes: null,
    archivedAt: null,
  };
}

export function buildRuntimeMappingPublishShadowEvaluation(
  input: RuntimeMappingPublishShadowInput,
): PublishShadowEvaluationDto {
  const inputErrors = validatePublishShadowInput(input);
  if (inputErrors.length > 0) {
    const summary = inputErrors.map((error) => `${error.path}: ${error.message}`).join("; ");
    throw new Error(`Invalid publish shadow input: ${summary}`);
  }

  const draftInput = toDraftValidationInput(input);
  const draftValidation = validateRuntimeMappingDraft(draftInput);
  if (!draftValidation.ok) {
    const summary = draftValidation.errors
      .map((error) => `${error.code}@${error.path}: ${error.message}`)
      .join("; ");
    throw new Error(`Invalid runtime mapping draft for shadow evaluation: ${summary}`);
  }

  assertValidRuntimeMappingDraft(draftInput);

  const dto: PublishShadowEvaluationDto = {
    shadowOnly: true,
    menuProfileId: input.menuProfileId.trim(),
    draftId: input.draftId.trim(),
    mappingVersion: input.mappingVersion.trim(),
    evaluatedAt: resolveEvaluatedAt(input),
    wouldMapCategories: extractWouldMapCategories(input.mappingJson),
    unmappedCategories: extractUnmappedCategories(input.unmappedCategoriesJson),
    warmDishPreviewSummary: summarizeWarmDishPreview(input.warmDishPreviewJson),
    blockedRuntimeActivationReasons: buildBlockedRuntimeActivationReasons(
      input.validationSummaryJson,
      input.mappingJson,
    ),
    publishImpact: { ...ZERO_PUBLISH_SHADOW_IMPACT },
    comparisonToCurrentPublish: {
      currentPublishUnchanged: true,
      notes: ["Shadow evaluation only — no menuDayPayload mutation"],
    },
  };

  assertValidPublishShadowEvaluation(dto);
  return dto;
}
