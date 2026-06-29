/** G5d.6b — compatibility cutover evaluation contract (tests only, not runtime DTO). */

export const COMPATIBILITY_CUTOVER_FLAG = "LP_MENU_PROFILE_COMPATIBILITY_CUTOVER";
export const COMPATIBILITY_CUTOVER_HELPER = "isMenuProfileCompatibilityCutoverEnabled";
export const COMPATIBILITY_CUTOVER_DOC_PATH =
  "docs/engineering/G5d6-compatibility-cutover-design-audit.md";
export const FUTURE_COMPATIBILITY_HELPER_PATH =
  "lib/menu-profile/runtimeCompatibilityCutover.server.ts";
export const COMPATIBILITY_CUTOVER_TYPES_PATH =
  "lib/menu-profile/runtimeCompatibilityCutoverTypes.ts";
export const CANONICAL_COMPATIBILITY_HELPER_PATH = FUTURE_COMPATIBILITY_HELPER_PATH;
export const FUTURE_COMPATIBILITY_API_PATH =
  "app/api/provider/menu-profile/compatibility-cutover/route.ts";
export const CANONICAL_COMPATIBILITY_API_PATH = FUTURE_COMPATIBILITY_API_PATH;

export type CompatibilityCutoverComparison = {
  currentNoRuntimeHash: string;
  candidateProfileRuntimeHash: string;
  hashesEqual: boolean;
  diffSummary: string[];
  manualReviewRequired: boolean;
};

/** Contract shape for future G5d.6c+ compatibility evaluation responses. */
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

/** Fields that must never appear in compatibility cutover output or client request bodies. */
export const COMPATIBILITY_CUTOVER_FORBIDDEN_OUTPUT_FIELDS = [
  "providerId",
  "employeePayload",
  "orderPayload",
  "publishPayload",
  "sanityWritePayload",
  "menuDayPayloadMutation",
  "pricePreview",
  "provider_price_rules",
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

export const COMPATIBILITY_CUTOVER_FORBIDDEN_SOURCE_OF_TRUTH_WORDS = [
  "apply",
  "commit",
  "publish",
  "activate",
  "enable",
  "productionEnable",
  "sourceOfTruth",
  "source_of_truth",
  "auto-rollout",
  "autoRollout",
] as const;

export const COMPATIBILITY_CUTOVER_BASE_BLOCKED_REASONS = [
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

export const G5D6_COMPATIBILITY_CUTOVER_CONTRACT_FIXTURE: CompatibilityCutoverEvaluationDto = {
  compatibilityOnly: true,
  providerOnly: true,
  evaluatedAt: "2026-06-28T22:00:00.000Z",
  providerMenuProfileId: "norwegian_company_lunch",
  sourceDraftId: "draft-compatibility-cutover-fixture",
  sourceMappingVersion: "g5d.1",
  currentNoRuntimeUnchanged: true,
  weekResponseChanges: 0,
  employeeVisibleChanges: 0,
  orderChanges: 0,
  publishChanges: 0,
  sanityWrites: 0,
  menuDayPayloadMutations: 0,
  priceVisibleChanges: 0,
  commercialVisibleChanges: 0,
  canProceedToPreviewCompare: true,
  canProceedToRuntimeHook: false,
  canProceedToProduction: false,
  blockedReasons: [...COMPATIBILITY_CUTOVER_BASE_BLOCKED_REASONS],
  requiredEvidence: [
    "preview_compare_smoke_required",
    "golden_path_must_pass",
    "week_response_hash_must_match",
    "employee_ui_must_be_unchanged",
    "order_flow_must_be_unchanged",
    "production_flags_must_remain_off",
    "rollback_plan_required",
  ],
  comparison: {
    currentNoRuntimeHash: "sha256:no-runtime-contract-fixture-current",
    candidateProfileRuntimeHash: "sha256:no-runtime-contract-fixture-current",
    hashesEqual: true,
    diffSummary: [],
    manualReviewRequired: false,
  },
};
