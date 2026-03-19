/**
 * LUNCHPORTALEN — State surface visual variants (primitives from lib/ui/motion.css).
 * Empty, loading (skeleton), error, success, paused. Wired via get*VariantClass() or class-based.
 * Text clarity first; prefer outline/soft for operational UI; glass must not reduce legibility; glow rare.
 */

export type StateSurfaceVariant = "glass" | "soft" | "gradient" | "outline" | "glow";

/** Generic state container (loading, empty, paused when no semantic) */
export const stateVariantClasses: Record<StateSurfaceVariant, string> = {
  glass: "lp-state-glass",
  soft: "lp-state-soft",
  gradient: "lp-state-gradient",
  outline: "lp-state-outline",
  glow: "lp-state-glow",
};

/** Skeleton block wrapper (compose with lp-motion-skeleton on inner placeholder) */
export const skeletonVariantClasses: Record<StateSurfaceVariant, string> = {
  glass: "lp-skeleton-glass",
  soft: "lp-skeleton-soft",
  gradient: "lp-skeleton-gradient",
  outline: "lp-skeleton-outline",
  glow: "lp-skeleton-glow",
};

/** Empty state surface */
export const emptyVariantClasses: Record<StateSurfaceVariant, string> = {
  glass: "lp-empty-glass",
  soft: "lp-empty-soft",
  gradient: "lp-empty-gradient",
  outline: "lp-empty-outline",
  glow: "lp-empty-glow",
};

/** Error state surface (high legibility, danger semantic) */
export const errorVariantClasses: Record<StateSurfaceVariant, string> = {
  glass: "lp-error-glass",
  soft: "lp-error-soft",
  gradient: "lp-error-gradient",
  outline: "lp-error-outline",
  glow: "lp-error-glow",
};

/** Success state surface (polished, calm; glow subtle only) */
export const successVariantClasses: Record<StateSurfaceVariant, string> = {
  glass: "lp-success-glass",
  soft: "lp-success-soft",
  gradient: "lp-success-gradient",
  outline: "lp-success-outline",
  glow: "lp-success-glow",
};

/** Paused / hold / block informational surface (neutral, not error) */
export const pausedVariantClasses: Record<StateSurfaceVariant, string> = {
  glass: "lp-paused-glass",
  soft: "lp-paused-soft",
  gradient: "lp-paused-gradient",
  outline: "lp-paused-outline",
  glow: "lp-paused-glow",
};

export function getStateVariantClass(variant: StateSurfaceVariant | undefined): string {
  return variant ? stateVariantClasses[variant] : "";
}

export function getSkeletonVariantClass(variant: StateSurfaceVariant | undefined): string {
  return variant ? skeletonVariantClasses[variant] : "";
}

export function getEmptyVariantClass(variant: StateSurfaceVariant | undefined): string {
  return variant ? emptyVariantClasses[variant] : "";
}

export function getErrorVariantClass(variant: StateSurfaceVariant | undefined): string {
  return variant ? errorVariantClasses[variant] : "";
}

export function getSuccessVariantClass(variant: StateSurfaceVariant | undefined): string {
  return variant ? successVariantClasses[variant] : "";
}

export function getPausedVariantClass(variant: StateSurfaceVariant | undefined): string {
  return variant ? pausedVariantClasses[variant] : "";
}
