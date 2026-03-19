/**
 * LUNCHPORTALEN — Form control visual variants (primitives from lib/ui/motion.css).
 * Wired to Input, Textarea, Select (components/ui). Pair with lp-motion-control.
 * Accessibility first: aria-invalid for error; focus-visible and disabled in CSS.
 * Prefer outline/soft for dense operational UI; glass must not reduce legibility; glow rare.
 */

export type FormControlVariant = "glass" | "soft" | "gradient" | "outline" | "glow";

/** Map variant to lp-input-* class (same class applies to input, textarea, select) */
export const inputVariantClasses: Record<FormControlVariant, string> = {
  glass: "lp-input-glass",
  soft: "lp-input-soft",
  gradient: "lp-input-gradient",
  outline: "lp-input-outline",
  glow: "lp-input-glow",
};

/** Map variant to lp-textarea-* class */
export const textareaVariantClasses: Record<FormControlVariant, string> = {
  glass: "lp-textarea-glass",
  soft: "lp-textarea-soft",
  gradient: "lp-textarea-gradient",
  outline: "lp-textarea-outline",
  glow: "lp-textarea-glow",
};

/** Map variant to lp-select-* class */
export const selectVariantClasses: Record<FormControlVariant, string> = {
  glass: "lp-select-glass",
  soft: "lp-select-soft",
  gradient: "lp-select-gradient",
  outline: "lp-select-outline",
  glow: "lp-select-glow",
};

export function getInputVariantClass(variant: FormControlVariant | undefined): string {
  return variant ? inputVariantClasses[variant] : "";
}

export function getTextareaVariantClass(variant: FormControlVariant | undefined): string {
  return variant ? textareaVariantClasses[variant] : "";
}

export function getSelectVariantClass(variant: FormControlVariant | undefined): string {
  return variant ? selectVariantClasses[variant] : "";
}
