/**
 * G5d.4c — Publish shadow evaluation types (pure, no I/O).
 * Not wired to API/UI/runtime cutover.
 */

export type PublishShadowWouldMapCategory = {
  profileCategoryKey: string;
  runtimeCategoryKey?: string | null;
  runtimeLunchCategoryKey?: string | null;
  runtimeOrderChoiceKey?: string | null;
  status: string;
};

export type PublishShadowWarmDishPreviewSummary = {
  count: number;
  previewOnly: true;
};

export type PublishShadowImpact = {
  runtimeWrites: 0;
  sanityWrites: 0;
  orderChanges: 0;
  weekChanges: 0;
  employeeVisibleChanges: 0;
};

export type PublishShadowComparison = {
  currentPublishUnchanged: true;
  notes: string[];
};

/** Shadow evaluation response — evidence only, never source of truth. No providerId. */
export type PublishShadowEvaluationDto = {
  shadowOnly: true;
  menuProfileId: string;
  draftId: string;
  mappingVersion: string;
  evaluatedAt: string;
  wouldMapCategories: PublishShadowWouldMapCategory[];
  unmappedCategories: string[];
  warmDishPreviewSummary: PublishShadowWarmDishPreviewSummary;
  blockedRuntimeActivationReasons: string[];
  publishImpact: PublishShadowImpact;
  comparisonToCurrentPublish: PublishShadowComparison;
};

/** Draft snapshot input for pure shadow evaluation (no DB read). */
export type RuntimeMappingPublishShadowInput = {
  draftId: string;
  menuProfileId: string;
  mappingVersion: string;
  sourceProfileVersion?: string | null;
  mappingJson: unknown;
  unmappedCategoriesJson: unknown;
  warmDishPreviewJson: unknown;
  validationSummaryJson: unknown;
  evaluatedAt?: string | Date;
  /** Used only when mapping to G5d.3c validation input. Default: draft. */
  draftStatus?: "draft" | "reviewed";
};

export type PublishShadowInputValidationError = {
  path: string;
  message: string;
};

export const PUBLISH_SHADOW_FORBIDDEN_DTO_FIELDS = [
  "providerId",
  "apply",
  "commit",
  "publish",
  "activate",
  "enable",
  "runtimeWritePayload",
  "sanityWritePayload",
  "orderPayload",
  "weekPayload",
  "employeePayload",
] as const;

export const PUBLISH_SHADOW_BASE_BLOCKED_REASONS = [
  "shadow_only_no_runtime_writes",
  "shadow_only_no_sanity_writes",
  "shadow_only_no_order_changes",
  "shadow_only_no_week_changes",
  "shadow_only_no_employee_visibility",
] as const;

export const ZERO_PUBLISH_SHADOW_IMPACT: PublishShadowImpact = {
  runtimeWrites: 0,
  sanityWrites: 0,
  orderChanges: 0,
  weekChanges: 0,
  employeeVisibleChanges: 0,
};
