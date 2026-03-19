/**
 * LUNCHPORTALEN — Header visual variants (primitives from lib/ui/motion.css).
 * Single source of truth for header shell styling; use with lp-topbar for structure.
 */

export type HeaderVariant = "glass" | "soft" | "gradient" | "outline" | "glow";

/** Map variant to lp-header-* class */
export const headerVariantClasses: Record<HeaderVariant, string> = {
  glass: "lp-header-glass",
  soft: "lp-header-soft",
  gradient: "lp-header-gradient",
  outline: "lp-header-outline",
  glow: "lp-header-glow",
};

export function getHeaderVariantClass(variant: HeaderVariant | undefined): string {
  return variant ? headerVariantClasses[variant] : "";
}
