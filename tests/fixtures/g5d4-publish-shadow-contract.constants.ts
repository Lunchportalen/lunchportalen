/** G5d.4b — publish shadow evaluation contract (tests only, not runtime DTO). */

export type PublishShadowWouldMapCategory = {
  profileCategoryKey: string;
  runtimeCategoryKey?: string;
  runtimeLunchCategoryKey?: string;
  runtimeOrderChoiceKey?: string;
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

/** Contract shape for future G5d.4c+ shadow evaluation responses. */
export type PublishShadowEvaluationDto = {
  shadowOnly: true;
  providerId: string;
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

/** Fields that must never appear on client-supplied shadow request bodies. */
export const PUBLISH_SHADOW_CLIENT_FORBIDDEN_BODY_FIELDS = [
  "providerId",
  "apply",
  "commit",
  "publish",
  "activate",
  "enable",
  "sourceOfTruth",
  "employeeVisible",
] as const;

/** Source-of-truth / activation words forbidden in shadow API contract strings. */
export const PUBLISH_SHADOW_FORBIDDEN_SOURCE_OF_TRUTH_WORDS = [
  "apply",
  "commit",
  "publish",
  "activate",
  "enable",
  "sourceOfTruth",
  "source_of_truth",
] as const;

export const G5D4_PUBLISH_SHADOW_CONTRACT_FIXTURE: PublishShadowEvaluationDto = {
  shadowOnly: true,
  providerId: "00000000-0000-0000-0000-000000000001",
  menuProfileId: "norwegian_company_lunch",
  draftId: "draft-contract-fixture",
  mappingVersion: "g5d.1",
  evaluatedAt: "2026-06-27T12:00:00.000Z",
  wouldMapCategories: [
    {
      profileCategoryKey: "salatboks",
      runtimeCategoryKey: "salat",
      runtimeLunchCategoryKey: "salatboks",
      runtimeOrderChoiceKey: "salatboks",
      status: "mapped_existing_no_runtime",
    },
  ],
  unmappedCategories: ["thaimat"],
  warmDishPreviewSummary: { count: 2, previewOnly: true },
  blockedRuntimeActivationReasons: ["Runtime activation fields rejected by G5d.3c validation"],
  publishImpact: {
    runtimeWrites: 0,
    sanityWrites: 0,
    orderChanges: 0,
    weekChanges: 0,
    employeeVisibleChanges: 0,
  },
  comparisonToCurrentPublish: {
    currentPublishUnchanged: true,
    notes: ["Shadow evaluation only — no menuDayPayload mutation"],
  },
};
