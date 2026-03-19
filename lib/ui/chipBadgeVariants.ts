/**
 * LUNCHPORTALEN — Chip and badge visual variants (primitives from lib/ui/motion.css).
 * Use getChipVariantClass(variant) / getBadgeVariantClass(variant) or class-based.
 * Compose with .lp-chip / .lp-badge (globals) and semantic (--success/--error/…); lp-chip--selected for selected.
 */

export type ChipBadgeVariant = "glass" | "soft" | "gradient" | "outline" | "glow";

export type ChipBadgeSemantic = "success" | "error" | "warning" | "info" | "neutral";

/** Map variant to lp-chip-* class */
export const chipVariantClasses: Record<ChipBadgeVariant, string> = {
  glass: "lp-chip-glass",
  soft: "lp-chip-soft",
  gradient: "lp-chip-gradient",
  outline: "lp-chip-outline",
  glow: "lp-chip-glow",
};

/** Map variant to lp-badge-* class */
export const badgeVariantClasses: Record<ChipBadgeVariant, string> = {
  glass: "lp-badge-glass",
  soft: "lp-badge-soft",
  gradient: "lp-badge-gradient",
  outline: "lp-badge-outline",
  glow: "lp-badge-glow",
};

/** Semantic modifier for chip (combine with lp-chip-*) */
export const chipSemanticClasses: Record<ChipBadgeSemantic, string> = {
  success: "lp-chip--success",
  error: "lp-chip--error",
  warning: "lp-chip--warning",
  info: "lp-chip--info",
  neutral: "lp-chip--neutral",
};

/** Semantic modifier for badge (combine with lp-badge-*) */
export const badgeSemanticClasses: Record<ChipBadgeSemantic, string> = {
  success: "lp-badge--success",
  error: "lp-badge--error",
  warning: "lp-badge--warning",
  info: "lp-badge--info",
  neutral: "lp-badge--neutral",
};

export function getChipVariantClass(variant: ChipBadgeVariant | undefined): string {
  return variant ? chipVariantClasses[variant] : chipVariantClasses.soft;
}

export function getBadgeVariantClass(variant: ChipBadgeVariant | undefined): string {
  return variant ? badgeVariantClasses[variant] : badgeVariantClasses.soft;
}

export function getChipSemanticClass(semantic: ChipBadgeSemantic | undefined): string {
  return semantic ? chipSemanticClasses[semantic] : "";
}

export function getBadgeSemanticClass(semantic: ChipBadgeSemantic | undefined): string {
  return semantic ? badgeSemanticClasses[semantic] : "";
}
