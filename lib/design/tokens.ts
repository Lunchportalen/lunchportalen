// lib/design/tokens.ts
// ------------------------------------------------------------
// Single source of truth for design tokens (TS side).
// Designet er låst av design/DESIGN_BRIEF.md.
// ------------------------------------------------------------

export type ColorTokens = {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;

  primary: string;
  primary2: string; // hover/active
  primaryContrast: string;

  accent: string;

  success: string;
  warning: string;
  danger: string;
};

export const colorsDark: ColorTokens = {
  // Base (warm enterprise)
  bg: "#faf7f1",
  surface: "#f4efe7",
  surface2: "#ede7df",
  border: "rgba(32,33,36,0.12)",

  // Text
  text: "#202124",
  muted: "rgba(32,33,36,0.62)",

  // Brand (muted gold)
  primary: "#b28b58",
  primary2: "#9a7449",
  primaryContrast: "#1f2124",

  // Accent (warm gold)
  accent: "#b28b58",

  // Status
  success: "#2f5c45",
  warning: "#7e5516",
  danger: "#78362e",
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
} as const;

export const shadows = {
  sm: "0 6px 18px rgba(0,0,0,0.25)",
  md: "0 12px 30px rgba(0,0,0,0.30)",
  lg: "0 22px 48px rgba(0,0,0,0.38)",
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 48,
  10: 56,
} as const;

/**
 * Helper: export CSS variables payload (optional use).
 * Brukes kun hvis du vil generere CSS vars fra tokens i runtime/build.
 * Vi bruker primært app/globals.css som source for CSS vars.
 */
export function tokensToCssVars(tokens: ColorTokens) {
  return {
    "--bg": tokens.bg,
    "--surface": tokens.surface,
    "--surface-2": tokens.surface2,
    "--border": tokens.border,
    "--text": tokens.text,
    "--muted": tokens.muted,

    "--primary": tokens.primary,
    "--primary-2": tokens.primary2,
    "--primary-contrast": tokens.primaryContrast,

    "--accent": tokens.accent,

    "--success": tokens.success,
    "--warning": tokens.warning,
    "--danger": tokens.danger,

    "--radius-sm": `${radii.sm}px`,
    "--radius-md": `${radii.md}px`,
    "--radius-lg": `${radii.lg}px`,
    "--radius-xl": `${radii.xl}px`,

    "--shadow-sm": shadows.sm,
    "--shadow-md": shadows.md,
    "--shadow-lg": shadows.lg,
  } as const;
}
