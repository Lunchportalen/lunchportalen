/**
 * LUNCHPORTALEN — Drawer / side panel visual variants (primitives from lib/ui/motion.css).
 * Use getDrawerVariantClass(variant) or class-based for slide-in drawers, inspector panels, sidebars.
 * Pair with lp-motion-overlay / lp-motion-panel for open/close transitions.
 */

export type DrawerVariant = "glass" | "soft" | "gradient" | "outline" | "glow";

/** Map variant to lp-drawer-* class */
export const drawerVariantClasses: Record<DrawerVariant, string> = {
  glass: "lp-drawer-glass",
  soft: "lp-drawer-soft",
  gradient: "lp-drawer-gradient",
  outline: "lp-drawer-outline",
  glow: "lp-drawer-glow",
};

export function getDrawerVariantClass(variant: DrawerVariant | undefined): string {
  return variant ? drawerVariantClasses[variant] : drawerVariantClasses.glass;
}
