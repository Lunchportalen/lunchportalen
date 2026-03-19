/**
 * LUNCHPORTALEN — Modal/dialog visual variants (primitives from lib/ui/motion.css).
 * Overlay = backdrop dim layer; Modal = panel shell. Wired to Dialog (components/ui/dialog.tsx).
 * Use with lp-motion-overlay for open/close transitions.
 */

export type ModalVariant = "glass" | "soft" | "gradient" | "outline" | "glow";

/** Map variant to lp-overlay-* class (backdrop) */
export const overlayVariantClasses: Record<ModalVariant, string> = {
  glass: "lp-overlay-glass",
  soft: "lp-overlay-soft",
  gradient: "lp-overlay-gradient",
  outline: "lp-overlay-outline",
  glow: "lp-overlay-glow",
};

/** Map variant to lp-modal-* class (panel shell) */
export const modalVariantClasses: Record<ModalVariant, string> = {
  glass: "lp-modal-glass",
  soft: "lp-modal-soft",
  gradient: "lp-modal-gradient",
  outline: "lp-modal-outline",
  glow: "lp-modal-glow",
};

export function getOverlayVariantClass(variant: ModalVariant | undefined): string {
  return variant ? overlayVariantClasses[variant] : overlayVariantClasses.glass;
}

export function getModalVariantClass(variant: ModalVariant | undefined): string {
  return variant ? modalVariantClasses[variant] : modalVariantClasses.glass;
}
