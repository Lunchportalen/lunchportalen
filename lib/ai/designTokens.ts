/**
 * CMS design tokens — aligned with Lunchportalen backoffice / public LP CSS variables.
 * Deterministic; reusable by analyzer, generator, and API.
 */

export type CmsSpacingToken = "sm" | "md" | "lg";

export type CmsTypographyRole = "h1" | "h2" | "body";

export type CmsDesignTokens = {
  spacing: Record<CmsSpacingToken, { label: string; value: string; tailwindHint: string }>;
  typography: Record<CmsTypographyRole, { fontSize: string; lineHeight: string; fontWeight: string; cssVar?: string }>;
  colors: {
    primary: { label: string; cssVar: string };
    secondary: { label: string; cssVar: string };
    muted: { label: string; cssVar: string };
  };
};

/**
 * Canonical token set — maps to existing `--lp-*` surface (see design system / globals).
 */
/**
 * Short fragment injected into layout/page LLM system prompts (multimodal CMS).
 * Kept in sync with `getCmsDesignTokens`.
 */
export function designTokensPromptFragment(): string {
  const t = getCmsDesignTokens();
  return `
Design tokens (visual rhythm for suggested blocks):
- Spacing: sm ${t.spacing.sm.value}, md ${t.spacing.md.value}, lg ${t.spacing.lg.value}
- Typography: H1 ${t.typography.h1.fontSize} / ${t.typography.h1.lineHeight}, H2 ${t.typography.h2.fontSize} / ${t.typography.h2.lineHeight}, body ${t.typography.body.fontSize} / ${t.typography.body.lineHeight}
- Colors: calm LP surfaces — primary text ${t.colors.primary.cssVar}, muted ${t.colors.muted.cssVar}; use a single strong accent only for the main CTA conceptually.
`.trim();
}

export function getCmsDesignTokens(): CmsDesignTokens {
  return {
    spacing: {
      sm: { label: "Tett", value: "0.75rem", tailwindHint: "gap-3 / py-3" },
      md: { label: "Standard", value: "1rem", tailwindHint: "gap-4 / py-4" },
      lg: { label: "Luftig", value: "1.5rem", tailwindHint: "gap-6 / py-6" },
    },
    typography: {
      h1: {
        fontSize: "1.875rem",
        lineHeight: "2.25rem",
        fontWeight: "600",
        cssVar: "--lp-text",
      },
      h2: {
        fontSize: "1.25rem",
        lineHeight: "1.75rem",
        fontWeight: "600",
        cssVar: "--lp-text",
      },
      body: {
        fontSize: "1rem",
        lineHeight: "1.5rem",
        fontWeight: "400",
        cssVar: "--lp-text",
      },
    },
    colors: {
      primary: { label: "Primær (tekst)", cssVar: "rgb(var(--lp-text))" },
      secondary: { label: "Sekundær (kortflate)", cssVar: "rgb(var(--lp-card))" },
      muted: { label: "Dempet", cssVar: "rgb(var(--lp-muted))" },
    },
  };
}
