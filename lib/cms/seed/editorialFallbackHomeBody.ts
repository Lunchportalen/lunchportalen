/**
 * Fail-closed body for allowlisted public routes when Umbraco (or local harness) returns no usable blocks.
 * Intentionally empty — not a substitute for Umbraco-published content.
 * @see buildMarketingHomeBody — retained for backoffice/AI/seed scripts only, not public runtime primary.
 */
import type { BlockList } from "@/lib/cms/model/blockTypes";

export function buildEditorialFallbackPublicBody(): BlockList {
  return {
    version: 1,
    meta: {
      surface: "lp_editorial_fallback",
      notEditorialLive: true,
    },
    blocks: [],
  };
}

/** @deprecated Use {@link buildEditorialFallbackPublicBody} */
export function buildEditorialFallbackHomeBody(): BlockList {
  return buildEditorialFallbackPublicBody();
}
