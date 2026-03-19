/**
 * Design token generator: produces color palette, spacing scale, and typography system.
 * Deterministic; no LLM. Use for new themes, design docs, or backoffice token preview.
 */

export type GenerateDesignTokensInput = {
  /** Optional theme hint: warm | neutral | enterprise (affects palette emphasis). */
  themeHint?: string | null;
  /** Optional base unit for spacing (default 0.25rem). */
  spacingBase?: string | null;
  /** Optional locale for labels (nb | en). */
  locale?: "nb" | "en" | null;
};

export type ColorToken = {
  name: string;
  role: string;
  value: string;
  /** Optional CSS variable name (e.g. --lp-text). */
  cssVar?: string;
};

export type ColorPalette = {
  primary: ColorToken[];
  neutral: ColorToken[];
  accent: ColorToken[];
  semantic: ColorToken[];
  /** Short description. */
  description?: string;
};

export type SpacingScale = {
  baseUnit: string;
  tokens: Array<{ name: string; value: string }>;
  /** Optional CSS variable names. */
  cssVars?: string[];
};

export type TypographyToken = {
  name: string;
  role: string;
  fontSize: string;
  lineHeight: string;
  fontWeight?: string;
  letterSpacing?: string;
  fontFamily?: string;
};

export type TypographySystem = {
  fontFamilies: {
    heading: string;
    body: string;
    mono?: string;
  };
  scale: TypographyToken[];
  /** Short description. */
  description?: string;
};

export type GenerateDesignTokensOutput = {
  colorPalette: ColorPalette;
  spacingScale: SpacingScale;
  typographySystem: TypographySystem;
  summary: string;
};

const DEFAULT_SPACING_BASE = "0.25rem";

function buildSpacingScale(baseUnit: string): SpacingScale["tokens"] {
  const base = parseFloat(baseUnit) || 0.25;
  const unit = baseUnit.replace(/[\d.]+/, "").trim() || "rem";
  const steps = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32];
  return steps.map((step) => ({
    name: `space-${step}`,
    value: `${step * base}${unit}`,
  }));
}

/**
 * Generates design tokens: color palette, spacing scale, typography system. Deterministic; no external calls.
 */
export function generateDesignTokens(input: GenerateDesignTokensInput = {}): GenerateDesignTokensOutput {
  const theme = (input.themeHint ?? "").trim().toLowerCase() || "warm";
  const isEn = input.locale === "en";
  const baseUnit = (input.spacingBase ?? DEFAULT_SPACING_BASE).trim() || DEFAULT_SPACING_BASE;

  const colorPalette: ColorPalette = {
    primary: [
      { name: "primary", role: "Primary brand", value: "#1a1a1a", cssVar: "--lp-primary" },
      { name: "primary-foreground", role: "On primary", value: "#ffffff", cssVar: "--lp-primary-foreground" },
    ],
    neutral: [
      { name: "background", role: "Page background", value: "#fafaf8", cssVar: "--lp-background" },
      { name: "surface", role: "Card/surface", value: "#ffffff", cssVar: "--lp-surface" },
      { name: "text", role: "Body text", value: "rgb(26, 26, 26)", cssVar: "--lp-text" },
      { name: "muted", role: "Muted text", value: "rgb(80, 80, 80)", cssVar: "--lp-muted" },
      { name: "border", role: "Borders", value: "rgb(220, 220, 215)", cssVar: "--lp-border" },
      { name: "divider", role: "Dividers", value: "rgb(235, 235, 230)", cssVar: "--lp-divider" },
    ],
    accent: [
      { name: "accent", role: "Accent (one primary action)", value: "#e91e82", cssVar: "--lp-accent" },
      { name: "accent-hover", role: "Accent hover", value: "#d81b6f", cssVar: "--lp-accent-hover" },
      { name: "accent-muted", role: "Accent subtle", value: "rgba(233, 30, 130, 0.12)", cssVar: "--lp-accent-muted" },
    ],
    semantic: [
      { name: "success", role: "Success", value: "rgb(22, 163, 74)", cssVar: "--lp-success" },
      { name: "warning", role: "Warning", value: "rgb(202, 138, 4)", cssVar: "--lp-warning" },
      { name: "error", role: "Error", value: "rgb(185, 28, 28)", cssVar: "--lp-error" },
    ],
    description: isEn ? "Warm base, graphite, single hot-pink accent." : "Varm base, grafitt, én hot-pink accent.",
  };

  if (theme === "neutral") {
    colorPalette.neutral[0].value = "#f5f5f5";
    colorPalette.description = isEn ? "Neutral grays, single accent." : "Nøytrale gråtoner, én accent.";
  } else if (theme === "enterprise") {
    colorPalette.neutral[0].value = "#f8f9fa";
    colorPalette.accent[0].value = "#0d6efd";
    colorPalette.accent[1].value = "#0b5ed7";
    colorPalette.description = isEn ? "Enterprise blue accent, light background." : "Enterprise blå accent, lys bakgrunn.";
  }

  const spacingScale: SpacingScale = {
    baseUnit,
    tokens: buildSpacingScale(baseUnit),
    cssVars: ["--lp-space-1", "--lp-space-2", "--lp-space-4", "--lp-space-6", "--lp-space-8"],
  };

  const typographySystem: TypographySystem = {
    fontFamilies: {
      heading: "Inter, system-ui, sans-serif",
      body: "Inter, system-ui, sans-serif",
      mono: "ui-monospace, monospace",
    },
    scale: [
      { name: "text-xs", role: "Caption", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "400" },
      { name: "text-sm", role: "Small", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "400" },
      { name: "text-base", role: "Body", fontSize: "1rem", lineHeight: "1.5rem", fontWeight: "400" },
      { name: "text-lg", role: "Lead", fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "400" },
      { name: "text-xl", role: "H4", fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "600" },
      { name: "text-2xl", role: "H3", fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "600" },
      { name: "text-3xl", role: "H2", fontSize: "1.875rem", lineHeight: "2.25rem", fontWeight: "600" },
      { name: "text-4xl", role: "H1", fontSize: "2.25rem", lineHeight: "2.5rem", fontWeight: "700" },
    ],
    description: isEn ? "Inter for headings and body; single scale for hierarchy." : "Inter for overskrifter og brødtekst; én skala for hierarki.",
  };

  const summary = isEn
    ? `Design tokens: ${colorPalette.primary.length + colorPalette.neutral.length + colorPalette.accent.length + colorPalette.semantic.length} colors, ${spacingScale.tokens.length} spacing steps, ${typographySystem.scale.length} type steps.`
    : `Designtokens: ${colorPalette.primary.length + colorPalette.neutral.length + colorPalette.accent.length + colorPalette.semantic.length} farger, ${spacingScale.tokens.length} avstandstrinn, ${typographySystem.scale.length} typetrinn.`;

  return {
    colorPalette,
    spacingScale,
    typographySystem,
    summary,
  };
}
