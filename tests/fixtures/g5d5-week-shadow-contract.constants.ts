/** G5d.5b — week shadow evaluation contract (tests only, not runtime DTO). */

export type WeekShadowWouldAffectDay = {
  dateISO: string;
  weekdayKey: "mon" | "tue" | "wed" | "thu" | "fri";
  status: "unchanged" | "hypothetical_diff_only" | "blocked";
  notes: string[];
};

export type WeekShadowComparison = {
  currentWeekPayloadHash: string;
  shadowWeekPayloadHash: string;
  hashesEqual: true;
  notes: string[];
};

/** Contract shape for future G5d.5c+ week shadow evaluation responses. */
export type WeekShadowEvaluationDto = {
  shadowOnly: true;
  providerOnly: true;
  evaluatedAt: string;
  menuProfileId: string;
  sourceDraftId: string;
  sourceMappingVersion: string;
  currentWeekUnchanged: true;
  employeeVisibleChanges: 0;
  orderChanges: 0;
  weekResponseChanges: 0;
  priceVisibleChanges: 0;
  commercialVisibleChanges: 0;
  wouldAffectDays: WeekShadowWouldAffectDay[];
  blockedReasons: string[];
  comparison: WeekShadowComparison;
};

/** Fields that must never appear in week shadow output or client request bodies. */
export const WEEK_SHADOW_FORBIDDEN_OUTPUT_FIELDS = [
  "employeePayload",
  "orderPayload",
  "menuDayPayloadMutation",
  "pricePreview",
  "provider_price_rules",
  "commission",
  "provisjon",
  "vat",
  "mva",
  "apply",
  "commit",
  "publish",
  "activate",
  "enable",
  "providerId",
] as const;

export const WEEK_SHADOW_FORBIDDEN_SOURCE_OF_TRUTH_WORDS = [
  "apply",
  "commit",
  "publish",
  "activate",
  "enable",
  "sourceOfTruth",
  "source_of_truth",
] as const;

export const WEEK_SHADOW_BASE_BLOCKED_REASONS = [
  "week_shadow_no_employee_visibility",
  "week_shadow_no_order_changes",
  "week_shadow_no_week_response_changes",
  "week_shadow_no_price_visible_changes",
  "week_shadow_no_commercial_visible_changes",
] as const;

export const G5D5_WEEK_SHADOW_CONTRACT_FIXTURE: WeekShadowEvaluationDto = {
  shadowOnly: true,
  providerOnly: true,
  evaluatedAt: "2026-06-28T12:00:00.000Z",
  menuProfileId: "norwegian_company_lunch",
  sourceDraftId: "draft-week-shadow-fixture",
  sourceMappingVersion: "g5d.1",
  currentWeekUnchanged: true,
  employeeVisibleChanges: 0,
  orderChanges: 0,
  weekResponseChanges: 0,
  priceVisibleChanges: 0,
  commercialVisibleChanges: 0,
  wouldAffectDays: [
    {
      dateISO: "2026-06-16",
      weekdayKey: "mon",
      status: "unchanged",
      notes: ["Hypothetical projection only — employee /week output unchanged"],
    },
  ],
  blockedReasons: [...WEEK_SHADOW_BASE_BLOCKED_REASONS],
  comparison: {
    currentWeekPayloadHash: "week-contract-fixture-current",
    shadowWeekPayloadHash: "week-contract-fixture-current",
    hashesEqual: true,
    notes: ["Week shadow comparison only — no /api/week mutation"],
  },
};
