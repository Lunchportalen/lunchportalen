import "server-only";

import {
  CTA_WIN_DEFAULT_TARGETS,
  promotePatternAcrossSurfaces,
  type CrossSurfacePromotion,
} from "@/lib/ai/crossSurfaceLearning";
import type { CmsSurface } from "@/lib/cms/surfaces";

import { productSurfaceToCmsSurface, type ProductSurface } from "@/lib/pos/surfaceRegistry";

export type { CrossSurfacePromotion };

const DEFAULT_PRODUCT_TARGETS: ProductSurface[] = ["onboarding", "company_admin", "employee", "week"];

/** Map POS surfaces to CMS namespaces used by {@link promotePatternAcrossSurfaces}. */
function toCmsSurfaceList(surfaces: ProductSurface[]): CmsSurface[] {
  const out: CmsSurface[] = [];
  for (const s of surfaces) {
    const m = productSurfaceToCmsSurface(s);
    if (m) out.push(m);
  }
  return out;
}

/**
 * When a pattern wins on one product surface, propose mirrored tests on others.
 * Reuses {@link promotePatternAcrossSurfaces} — no storage writes.
 */
export function proposeCrossSurfaceRollouts(
  fromSurface: ProductSurface,
  basePatternKey: string,
  targetProductSurfaces: ProductSurface[] = DEFAULT_PRODUCT_TARGETS,
): CrossSurfacePromotion[] {
  const from = productSurfaceToCmsSurface(fromSurface);
  if (!from) return [];
  const cmsTargets = toCmsSurfaceList(targetProductSurfaces);
  if (cmsTargets.length === 0) return [];
  return promotePatternAcrossSurfaces(from, basePatternKey, cmsTargets);
}

/**
 * Legacy CTA win expansion (CMS-native list) exposed for POS callers that already use {@link CmsSurface}.
 */
export function ctaWinDefaultCmsTargets(): CmsSurface[] {
  return [...CTA_WIN_DEFAULT_TARGETS];
}
