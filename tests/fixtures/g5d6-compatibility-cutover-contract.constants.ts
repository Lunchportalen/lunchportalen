/** G5d.6b — compatibility cutover evaluation contract (tests only, not runtime DTO). */

export const COMPATIBILITY_CUTOVER_FLAG = "LP_MENU_PROFILE_COMPATIBILITY_CUTOVER";
export const COMPATIBILITY_CUTOVER_HELPER = "isMenuProfileCompatibilityCutoverEnabled";
export const COMPATIBILITY_CUTOVER_DOC_PATH =
  "docs/engineering/G5d6-compatibility-cutover-design-audit.md";
export const FUTURE_COMPATIBILITY_HELPER_PATH =
  "lib/menu-profile/runtimeCompatibilityCutover.server.ts";
export const FUTURE_COMPATIBILITY_API_PATH =
  "app/api/provider/menu-profile/compatibility-cutover/route.ts";

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
  sourceDraftId: string;
  sourceMappingVersion: string;
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
  "compatibility_only_provider_evidence",
  "no_week_runtime_change",
  "no_employee_visibility",
  "no_order_changes",
  "no_publish_changes",
  "no_sanity_writes",
  "no_menu_day_payload_mutation",
  "no_price_commercial_exposure",
  "runtime_hook_not_authorized",
  "production_not_authorized",
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
  requiredEvidence: ["g5d4-publish-shadow-evidence", "g5d5-week-shadow-evidence"],
  comparison: {
    currentNoRuntimeHash: "sha256:no-runtime-contract-fixture-current",
    candidateProfileRuntimeHash: "sha256:no-runtime-contract-fixture-current",
    hashesEqual: true,
    diffSummary: [],
    manualReviewRequired: false,
  },
};
