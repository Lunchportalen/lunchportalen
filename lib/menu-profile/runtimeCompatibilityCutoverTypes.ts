/**
 * G5d.6c — Compatibility cutover comparison types (pure, no I/O).
 * Not wired to API/UI/runtime cutover.
 */

export type CompatibilityRuntimeSnapshotKind = "current_no_runtime" | "candidate_profile_runtime";

export type CompatibilityRuntimeSnapshot = {
  snapshotKind: CompatibilityRuntimeSnapshotKind;
  menuProfileId?: string;
  mappingVersion?: string;
  sourceDraftId?: string;
  sourceMappingVersion?: string;
  generatedAt?: string;
  days?: unknown[];
  metadata?: Record<string, unknown>;
  notes?: string[];
};

export type CompatibilityCutoverComparison = {
  currentNoRuntimeHash: string;
  candidateProfileRuntimeHash: string;
  hashesEqual: boolean;
  diffSummary: string[];
  manualReviewRequired: boolean;
};

/** Compatibility evaluation response — evidence only, never source of truth. Provider-only. */
export type CompatibilityCutoverEvaluationDto = {
  compatibilityOnly: true;
  providerOnly: true;
  evaluatedAt: string;
  providerMenuProfileId: string;
  sourceDraftId: string | null;
  sourceMappingVersion: string | null;
  currentNoRuntimeUnchanged: true;
  weekResponseChanges: 0;
  employeeVisibleChanges: 0;
  orderChanges: 0;
  publishChanges: 0;
  sanityWrites: 0;
  menuDayPayloadMutations: 0;
  priceVisibleChanges: 0;
  commercialVisibleChanges: 0;
  canProceedToPreviewCompare: boolean;
  canProceedToRuntimeHook: false;
  canProceedToProduction: false;
  blockedReasons: string[];
  requiredEvidence: string[];
  comparison: CompatibilityCutoverComparison;
};

export type CompatibilityCutoverInput = {
  providerMenuProfileId: string;
  sourceDraftId?: string | null;
  sourceMappingVersion?: string | null;
  currentNoRuntimeSnapshot: CompatibilityRuntimeSnapshot;
  candidateProfileRuntimeSnapshot: CompatibilityRuntimeSnapshot;
  evaluatedAt?: string;
  requiredEvidence?: string[];
  blockedReasons?: string[];
};

export type CompatibilityCutoverValidationResult = {
  ok: boolean;
  errors: string[];
};

export const COMPATIBILITY_CUTOVER_FORBIDDEN_FIELD_NAMES = [
  "providerId",
  "employeePayload",
  "orderPayload",
  "publishPayload",
  "sanityWritePayload",
  "menuDayPayloadMutation",
  "pricePreview",
  "provider" + "_price" + "_rules",
  "commission",
  "provisjon",
  "vat",
  "mva",
  "activate",
  "publish",
  "enable",
  "apply",
  "commit",
  "productionEnable",
] as const;

export const COMPATIBILITY_CUTOVER_HELPER_BASE_BLOCKED_REASONS = [
  "compatibility_only_no_runtime_cutover",
  "compatibility_only_no_production_activation",
  "compatibility_only_no_source_of_truth_switch",
  "compatibility_only_no_auto_rollout",
  "compatibility_only_no_employee_visibility",
  "compatibility_only_no_order_changes",
  "compatibility_only_no_publish_mutation",
  "compatibility_only_no_sanity_writes",
  "compatibility_only_no_menu_day_payload_mutation",
] as const;

export const COMPATIBILITY_CUTOVER_DEFAULT_REQUIRED_EVIDENCE = [
  "preview_compare_smoke_required",
  "golden_path_must_pass",
  "week_response_hash_must_match",
  "employee_ui_must_be_unchanged",
  "order_flow_must_be_unchanged",
  "production_flags_must_remain_off",
  "rollback_plan_required",
] as const;

export const ZERO_COMPATIBILITY_CUTOVER_CHANGE_COUNTERS = {
  weekResponseChanges: 0 as const,
  employeeVisibleChanges: 0 as const,
  orderChanges: 0 as const,
  publishChanges: 0 as const,
  sanityWrites: 0 as const,
  menuDayPayloadMutations: 0 as const,
  priceVisibleChanges: 0 as const,
  commercialVisibleChanges: 0 as const,
};
