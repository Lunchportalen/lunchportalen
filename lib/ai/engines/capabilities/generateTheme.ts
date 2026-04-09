/**
 * AI theme generator capability: generateTheme.
 * Produces a visual theme (colors, spacing, typography) aligned with brand: calm base,
 * single accent (hot-pink default), Inter for headings. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";
import { generateDesignTokens } from "../../design/generateDesignTokens";

const CAPABILITY_NAME = "generateTheme";

const generateThemeCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates a visual theme (colors, spacing, typography) aligned with brand: calm base, single accent (hot-pink default), Inter for headings. Returns theme object and optional CSS variables snippet. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Generate theme input",
    properties: {
      themeHint: {
        type: "string",
        description: "warm | neutral | enterprise (affects palette)",
      },
      spacingBase: { type: "string", description: "Base unit for spacing (e.g. 0.25rem)" },
      locale: { type: "string", description: "Locale for labels (nb | en)" },
      format: {
        type: "string",
        description: "Output format: cssVars | tailwind | full (default full)",
      },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Generated theme",
    required: ["themeName", "colors", "spacing", "typography", "summary"],
    properties: {
      themeName: { type: "string", description: "Theme identifier" },
      colors: {
        type: "object",
        description: "Flat map of color names to CSS values",
      },
      spacing: {
        type: "object",
        description: "Spacing scale (baseUnit + tokens)",
      },
      typography: {
        type: "object",
        description: "Font families and type scale",
      },
      cssSnippet: { type: "string", description: "Optional :root CSS variables block" },
      summary: { type: "string", description: "Short description" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is theme data only; no system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateThemeCapability);

export type GenerateThemeInput = {
  themeHint?: string | null;
  spacingBase?: string | null;
  locale?: "nb" | "en" | null;
  format?: "cssVars" | "tailwind" | "full" | null;
};

export type GenerateThemeOutput = {
  themeName: string;
  colors: Record<string, string>;
  spacing: { baseUnit: string; tokens: Array<{ name: string; value: string }> };
  typography: { fontFamilies: { heading: string; body: string; mono?: string }; scale: Array<Record<string, unknown>> };
  cssSnippet?: string;
  summary: string;
};

function flattenColors(
  palette: ReturnType<typeof generateDesignTokens>["colorPalette"]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const group of [palette.primary, palette.neutral, palette.accent, palette.semantic]) {
    for (const t of group) {
      out[t.name] = t.value;
      if (t.cssVar) out[t.cssVar] = t.value;
    }
  }
  return out;
}

function buildCssSnippet(colors: Record<string, string>): string {
  const vars: string[] = [];
  const rootVars = ["--lp-primary", "--lp-background", "--lp-surface", "--lp-text", "--lp-muted", "--lp-border", "--lp-accent", "--lp-accent-hover", "--lp-accent-muted", "--lp-success", "--lp-warning", "--lp-error"];
  for (const v of rootVars) {
    if (colors[v] !== undefined) vars.push(`  ${v}: ${colors[v]};`);
  }
  if (vars.length === 0) return "";
  return `:root {\n${vars.join("\n")}\n}`;
}

/**
 * Generates a theme from design tokens. Deterministic; no external calls.
 */
export function generateTheme(input: GenerateThemeInput = {}): GenerateThemeOutput {
  const themeHint = (input.themeHint ?? "warm").trim().toLowerCase() || "warm";
  const format = (input.format ?? "full").trim().toLowerCase() || "full";

  const tokens = generateDesignTokens({
    themeHint: themeHint === "neutral" || themeHint === "enterprise" ? themeHint : "warm",
    spacingBase: input.spacingBase ?? undefined,
    locale: input.locale ?? undefined,
  });

  const themeName =
    themeHint === "enterprise"
      ? "lunchportalen-enterprise"
      : themeHint === "neutral"
        ? "lunchportalen-neutral"
        : "lunchportalen-warm";

  const colors = flattenColors(tokens.colorPalette);
  const spacing = {
    baseUnit: tokens.spacingScale.baseUnit,
    tokens: tokens.spacingScale.tokens,
  };
  const typography = {
    fontFamilies: tokens.typographySystem.fontFamilies,
    scale: tokens.typographySystem.scale.map((t) => ({
      name: t.name,
      role: t.role,
      fontSize: t.fontSize,
      lineHeight: t.lineHeight,
      fontWeight: t.fontWeight,
      fontFamily: t.fontFamily,
    })),
  };

  let cssSnippet: string | undefined;
  if (format === "cssVars" || format === "full") {
    cssSnippet = buildCssSnippet(colors);
  }

  return {
    themeName,
    colors,
    spacing,
    typography,
    ...(cssSnippet ? { cssSnippet } : {}),
    summary: tokens.summary,
  };
}

export { generateThemeCapability, CAPABILITY_NAME };
