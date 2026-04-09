import type { UserBehavior } from "./behavior";

export type AdvancedSegment =
  | "hot"
  | "engaged"
  | "enterprise"
  | "mid_company"
  | "cold";

export type LeadLike = {
  meta?: Record<string, unknown> | null;
};

/**
 * Deterministisk segment: konvertering + engasjement + firmastørrelse (siste vinner ikke — fast prioritet).
 */
export function assignAdvancedSegment(lead: LeadLike | null | undefined, behavior: UserBehavior): AdvancedSegment {
  const raw = lead?.meta?.company_size;
  const size =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw.replace(/\s/g, ""))
        : 0;
  const n = Number.isFinite(size) ? size : 0;

  if (behavior.conversions > 0) return "hot";
  if (behavior.engagementScore > 20) return "engaged";
  if (n > 100) return "enterprise";
  if (n > 20) return "mid_company";
  return "cold";
}
