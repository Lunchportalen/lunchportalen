/**
 * LUNCHPORTALEN — Premium font registry (single source of truth).
 * Curated semantic roles only. No raw font-family input; no arbitrary fonts.
 * Aligns with app/layout.tsx next/font variables: --lp-font-body, --lp-font-heading, --lp-font-display.
 */

/** Semantic font roles. Use these instead of raw font-family values. */
export const FONT_ROLES = [
  "body",
  "heading",
  "display",
  "editorial",
  "campaign",
  "accent",
  "ui",
] as const;

export type FontRole = (typeof FONT_ROLES)[number];

/** Approved CSS variable names for the three loaded premium families (layout.tsx). */
const FONT_CSS_VARS = {
  body: "--lp-font-body", // Manrope
  heading: "--lp-font-heading", // Inter
  display: "--lp-font-display", // Fraunces
} as const;

/** Shared premium fallback stack (system UI, no arbitrary families). */
const FALLBACK_STACK =
  "system-ui, -apple-system, \"Segoe UI\", \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif";

/** Maps each semantic role to the underlying CSS var (one of the three loaded fonts). */
const ROLE_TO_VAR: Record<FontRole, string> = {
  body: FONT_CSS_VARS.body,
  heading: FONT_CSS_VARS.heading,
  display: FONT_CSS_VARS.display,
  editorial: FONT_CSS_VARS.display,
  campaign: FONT_CSS_VARS.display,
  accent: FONT_CSS_VARS.heading,
  ui: FONT_CSS_VARS.body,
};

/** Registry entry: CSS variable and fallback stack. Not exposed for arbitrary override. */
export type FontRegistryEntry = {
  cssVar: string;
  fallbackStack: string;
};

/** Curated premium font registry. Only approved roles; no raw font-family input. */
export const fontRegistry: Record<FontRole, FontRegistryEntry> = {
  body: { cssVar: FONT_CSS_VARS.body, fallbackStack: FALLBACK_STACK },
  heading: { cssVar: FONT_CSS_VARS.heading, fallbackStack: FALLBACK_STACK },
  display: { cssVar: FONT_CSS_VARS.display, fallbackStack: FALLBACK_STACK },
  editorial: { cssVar: FONT_CSS_VARS.display, fallbackStack: FALLBACK_STACK },
  campaign: { cssVar: FONT_CSS_VARS.display, fallbackStack: FALLBACK_STACK },
  accent: { cssVar: FONT_CSS_VARS.heading, fallbackStack: FALLBACK_STACK },
  ui: { cssVar: FONT_CSS_VARS.body, fallbackStack: FALLBACK_STACK },
};

/**
 * Returns the full font-family value for a semantic role.
 * Use this instead of raw font-family strings.
 */
export function getFontFamily(role: FontRole): string {
  const { cssVar, fallbackStack } = fontRegistry[role];
  return `var(${cssVar}), ${fallbackStack}`;
}

/** Returns the CSS variable name for a role (e.g. for inline style or Tailwind). */
export function getFontCssVar(role: FontRole): string {
  return fontRegistry[role].cssVar;
}

/**
 * Tailwind/globals.css class names for each semantic role.
 * Use these instead of raw font-family or hard-coded class strings.
 */
export const typographyTokenClasses: Record<FontRole, string> = {
  body: "font-body",
  heading: "font-heading",
  display: "font-display",
  editorial: "font-editorial",
  campaign: "font-campaign",
  accent: "font-accent",
  ui: "font-ui",
};

/* ========== CMS / theme font selection (approved options only) ========== */

/** Only these three options are allowed in theme/CMS. No raw font-family. */
export type ThemeFontOption = "body" | "heading" | "display";

/** Approved premium options for CMS selectors. Resolves to registry only. */
export const APPROVED_FONT_OPTIONS: ReadonlyArray<{ value: ThemeFontOption; label: string }> = [
  { value: "body", label: "Body (Manrope)" },
  { value: "heading", label: "Heading (Inter)" },
  { value: "display", label: "Display (Fraunces)" },
];

/** Default mapping: semantic role → approved option (matches current registry). */
export const DEFAULT_THEME_FONT_BY_ROLE: Record<FontRole, ThemeFontOption> = {
  body: "body",
  heading: "heading",
  display: "display",
  editorial: "display",
  campaign: "display",
  accent: "heading",
  ui: "body",
};

/** Labels for each semantic role in CMS (Display Font, Heading Font, etc.). */
export const FONT_ROLE_LABELS: Record<FontRole, string> = {
  body: "Body Font",
  heading: "Heading Font",
  display: "Display Font",
  editorial: "Editorial Font",
  campaign: "Campaign Font",
  accent: "Accent Font",
  ui: "UI Font",
};

/* ========== Validation & safe resolution (fail-safe typography) ========== */

/** Set of approved theme font values. Use for validation only. */
const APPROVED_THEME_FONT_VALUES: ReadonlySet<string> = new Set(
  APPROVED_FONT_OPTIONS.map((o) => o.value)
);

/**
 * Returns true if value is an approved ThemeFontOption. Use before accepting stored/API values.
 */
export function isThemeFontOption(value: unknown): value is ThemeFontOption {
  return typeof value === "string" && APPROVED_THEME_FONT_VALUES.has(value);
}

/**
 * Resolves a single role's font selection to an approved option. Invalid or missing values
 * fall back to the default for that role. Use when reading from settings/API/localStorage.
 */
export function resolveThemeFontOption(
  role: FontRole,
  value: unknown
): ThemeFontOption {
  if (isThemeFontOption(value)) return value;
  return DEFAULT_THEME_FONT_BY_ROLE[role];
}

/**
 * Resolves a full theme font map from raw input. Missing or invalid entries get the
 * default for that role. Prevents broken/stale typography settings from corrupting rendering.
 */
export function resolveThemeFontByRole(
  raw: unknown
): Record<FontRole, ThemeFontOption> {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = {} as Record<FontRole, ThemeFontOption>;
  for (const role of FONT_ROLES) {
    out[role] = resolveThemeFontOption(role, obj[role]);
  }
  return out;
}

/** Maps approved theme option to Tailwind/globals token class (for safe render path). */
const THEME_OPTION_TO_TOKEN_CLASS: Record<ThemeFontOption, string> = {
  body: "font-body",
  heading: "font-heading",
  display: "font-display",
};

/**
 * Returns the typography token class for a role given (possibly raw) theme settings.
 * Invalid or missing settings fall back to default; never returns an ambiguous or invalid class.
 */
export function getTypographyTokenForThemeRole(
  role: FontRole,
  themeFontByRole?: Record<FontRole, ThemeFontOption> | null
): string {
  const resolved = themeFontByRole
    ? resolveThemeFontOption(role, themeFontByRole[role])
    : DEFAULT_THEME_FONT_BY_ROLE[role];
  return THEME_OPTION_TO_TOKEN_CLASS[resolved];
}
