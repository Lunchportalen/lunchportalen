/**
 * LUNCHPORTALEN — Footer visual variants (primitives from lib/ui/motion.css).
 * Single source of truth for footer shell styling; use with lp-footer lp-footer--full for structure.
 */

export type FooterVariant = "glass" | "soft" | "gradient" | "outline" | "glow";

/** Map variant to lp-footer-* class */
export const footerVariantClasses: Record<FooterVariant, string> = {
  glass: "lp-footer-glass",
  soft: "lp-footer-soft",
  gradient: "lp-footer-gradient",
  outline: "lp-footer-outline",
  glow: "lp-footer-glow",
};

export function getFooterVariantClass(variant: FooterVariant | undefined): string {
  return variant ? footerVariantClasses[variant] : "";
}
