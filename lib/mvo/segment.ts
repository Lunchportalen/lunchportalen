import type { SegmentId } from "./dimensions";

export type LeadLike = {
  meta?: Record<string, unknown> | null;
};

/**
 * Deterministisk segment fra `company_size` (meta), tall eller parsbar streng.
 */
export function assignSegment(lead: LeadLike | null | undefined): SegmentId {
  const raw = lead?.meta?.company_size;
  const size =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw.replace(/\s/g, ""))
        : 0;
  const n = Number.isFinite(size) ? size : 0;

  if (n < 20) return "small_company";
  if (n < 100) return "mid_company";
  return "enterprise";
}
