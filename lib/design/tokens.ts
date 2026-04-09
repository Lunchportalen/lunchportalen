/**
 * Lunchportalen design tokens — Tailwind class fragments for shared UI.
 * Use these in DS components; avoid string concatenation for dynamic Tailwind (JIT).
 */

export const colors = {
  primary: "pink-500",
  primarySoft: "pink-50",
  accent: "purple-600",
  border: "slate-200",
  surface: "white",
} as const;

export const spacing = {
  xs: "p-2",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
} as const;

export const radius = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-xl",
} as const;

export const shadow = {
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
} as const;

/** Cross-surface motion (keep in sync with editor / backoffice). */
export const motion = {
  transition: "transition-all duration-200 ease-out",
  transitionFast: "transition-all duration-150 ease-out",
  liftHover: "hover:-translate-y-px",
} as const;

/** Focus ring aligned with brand accent (hot pink micro-highlight). */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/35 focus-visible:ring-offset-2";
