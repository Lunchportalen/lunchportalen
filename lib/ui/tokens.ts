/**
 * Superadmin Control Tower + enterprise aliases for the canonical design system.
 * DS components should still prefer `@/lib/design/tokens` + `@/components/ui/ds` (canonical: `src/components/ui/ds`).
 */

export { colors, focusRing, motion, radius, shadow, spacing } from "@/lib/design/tokens";

/** Calm surface + depth — aligned with LP border token, no extra primary colors. */
export const enterpriseSurface = {
  glass: "backdrop-blur-xl bg-white/60 border border-[rgb(var(--lp-border))]",
  cardLift: "transition-all duration-200 ease-out hover:-translate-y-px",
} as const;

/**
 * Inline-style bundle for legacy superadmin cards (numeric spacing = px).
 */
export const ui = {
  spacing: { xs: 8, sm: 12, md: 16, lg: 24, xl: 32 },
  radius: "16px",
  shadow: "0 10px 30px rgba(0,0,0,0.08)",
  glass: {
    background: "rgba(255,255,255,0.72)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(0,0,0,0.06)",
  },
} as const;
