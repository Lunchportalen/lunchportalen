import type { CmsSurface } from "@/lib/cms/surfaces";

import { surfaceScopedPatternKey } from "@/lib/ai/learningBySurface";

export type CrossSurfacePromotion = {
  fromSurface: CmsSurface;
  toSurface: CmsSurface;
  sourcePatternKey: string;
  promotedPatternKey: string;
  rationale: string;
};

/**
 * When a CTA-oriented pattern wins on one surface, propose mirrored experiments on others.
 * Does not mutate storage — returns candidate keys for experiments / human review only.
 */
export function promotePatternAcrossSurfaces(
  fromSurface: CmsSurface,
  basePatternKey: string,
  targetSurfaces: CmsSurface[],
): CrossSurfacePromotion[] {
  const key = String(basePatternKey ?? "").trim();
  if (!key) return [];
  const out: CrossSurfacePromotion[] = [];
  for (const toSurface of targetSurfaces) {
    if (toSurface === fromSurface) continue;
    out.push({
      fromSurface,
      toSurface,
      sourcePatternKey: surfaceScopedPatternKey(fromSurface, key),
      promotedPatternKey: surfaceScopedPatternKey(toSurface, key),
      rationale: `Re-test pattern «${key}» observed on ${fromSurface} in context ${toSurface}.`,
    });
  }
  return out;
}

/** Default expansion set when a public CTA pattern wins. */
export const CTA_WIN_DEFAULT_TARGETS: CmsSurface[] = [
  "onboarding",
  "company_admin_dashboard",
  "employee_app",
];
