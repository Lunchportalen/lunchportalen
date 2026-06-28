/**
 * G5d.5c — Week shadow comparison types (pure, no I/O).
 * Not wired to API/UI/runtime cutover.
 */

export type WeekShadowWouldAffectDay = {
  dateISO: string;
  weekdayKey: "mon" | "tue" | "wed" | "thu" | "fri";
  status: "unchanged" | "hypothetical_diff_only" | "blocked";
  notes: string[];
};

export type WeekShadowComparison = {
  currentWeekPayloadHash: string;
  shadowWeekPayloadHash: string;
  hashesEqual: boolean;
  notes: string[];
};

/** Shadow evaluation response — evidence only, never source of truth. Provider-only. */
export type WeekShadowEvaluationDto = {
  shadowOnly: true;
  providerOnly: true;
  evaluatedAt: string;
  menuProfileId: string;
  sourceDraftId: string;
  sourceMappingVersion: string;
  currentWeekUnchanged: boolean;
  employeeVisibleChanges: 0;
  orderChanges: 0;
  weekResponseChanges: 0;
  priceVisibleChanges: 0;
  commercialVisibleChanges: 0;
  wouldAffectDays: WeekShadowWouldAffectDay[];
  blockedReasons: string[];
  comparison: WeekShadowComparison;
};

export type WeekShadowPublishShadowEvidence = {
  shadowOnly?: boolean;
  publishImpact?: {
    runtimeWrites?: number;
    sanityWrites?: number;
    orderChanges?: number;
    weekChanges?: number;
    employeeVisibleChanges?: number;
  };
  meta?: {
    runtimeWrites?: number;
    sanityWrites?: number;
    orderChanges?: number;
    weekChanges?: number;
    employeeVisibleChanges?: number;
  };
};

export type WeekShadowComparisonInput = {
  menuProfileId: string;
  sourceDraftId: string;
  sourceMappingVersion: string;
  currentWeekPayload: unknown;
  shadowWeekPayload: unknown;
  publishShadow?: WeekShadowPublishShadowEvidence;
  evaluatedAt?: string;
};

export type WeekShadowValidationResult = {
  ok: boolean;
  errors: string[];
};

export const WEEK_SHADOW_HELPER_BASE_BLOCKED_REASONS = [
  "shadow_only_provider_evidence",
  "no_week_runtime_change",
  "no_employee_visibility",
  "no_order_changes",
  "no_publish_changes",
  "no_sanity_writes",
  "no_menu_day_payload_mutation",
] as const;

export const WEEK_SHADOW_FORBIDDEN_OUTPUT_FIELDS = [
  "employeePayload",
  "orderPayload",
  "menuDayPayloadMutation",
  "pricePreview",
  "provider" + "_price" + "_rules",
  "commission",
  "provisjon",
  "vat",
  "mva",
  "apply",
  "commit",
  "publishPayload",
  "activate",
  "enable",
  "lp_order_set",
  "lp_order_advance_status",
] as const;

export const ZERO_WEEK_SHADOW_CHANGE_COUNTERS = {
  employeeVisibleChanges: 0 as const,
  orderChanges: 0 as const,
  weekResponseChanges: 0 as const,
  priceVisibleChanges: 0 as const,
  commercialVisibleChanges: 0 as const,
};
