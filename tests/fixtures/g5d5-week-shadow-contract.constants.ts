/** G5d.5b/5c — week shadow evaluation contract (tests only, not runtime DTO). */

import type {
  WeekShadowComparison,
  WeekShadowEvaluationDto,
  WeekShadowWouldAffectDay,
} from "@/lib/menu-profile/runtimeMappingWeekShadowTypes";
import { WEEK_SHADOW_HELPER_BASE_BLOCKED_REASONS } from "@/lib/menu-profile/runtimeMappingWeekShadowTypes";

export type { WeekShadowComparison, WeekShadowEvaluationDto, WeekShadowWouldAffectDay };

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

export const WEEK_SHADOW_BASE_BLOCKED_REASONS = [...WEEK_SHADOW_HELPER_BASE_BLOCKED_REASONS];

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
  wouldAffectDays: [],
  blockedReasons: [...WEEK_SHADOW_BASE_BLOCKED_REASONS],
  comparison: {
    currentWeekPayloadHash: "sha256:week-contract-fixture-current",
    shadowWeekPayloadHash: "sha256:week-contract-fixture-current",
    hashesEqual: true,
    notes: ["Week shadow comparison only — no /api/week mutation"],
  },
};
