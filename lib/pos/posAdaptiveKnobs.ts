import "server-only";

import type { ProductSurface } from "@/lib/pos/surfaceRegistry";

/** Effective tuning knobs for one POS cycle (DB + env fallbacks). */
export type PosAdaptiveKnobsLoaded = {
  minConfidence: number;
  maxActiveSurfaces: number;
  surfaceMultiplier: Partial<Record<ProductSurface, number>>;
  fromDb: boolean;
};
