/**
 * LUNCHPORTALEN — Design globals (aligns with app/globals.css :root --lp-*).
 * Single reference for icon sizes, radius, and CSS var names used in TS.
 * Do not duplicate shadow/color values here; globals.css is source of truth.
 */

/** Icon dimensions (px). Use .lp-icon-xs | .lp-icon-sm | .lp-icon-md | .lp-icon-lg for consistency. */
export const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
} as const;

/** Radius (px) aligned with --lp-radius-btn, --lp-radius-card. */
export const radiusPx = {
  btn: 12,
  card: 18,
} as const;

/** CSS variable names (for reference; use in className as var(--lp-*) in Tailwind). */
export const cssVarNames = {
  border: "var(--lp-border)",
  text: "var(--lp-text)",
  muted: "var(--lp-muted)",
  surface: "var(--lp-surface)",
  surfaceAlt: "var(--lp-surface-alt)",
  card: "var(--lp-card)",
  ring: "var(--lp-ring)",
  shadowSoft: "var(--lp-shadow-soft)",
  shadowCard: "var(--lp-shadow-card)",
  success: "var(--lp-success)",
} as const;
