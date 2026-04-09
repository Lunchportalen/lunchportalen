/**
 * Design optimizer: reads page structure + global DesignSettings, returns explainable suggestions.
 * Patches only `settings.data.designSettings` (never block `data` / styling in blocks).
 * Deterministic heuristics — no LLM — so every suggestion is reversible and auditable.
 */

import type {
  CardHover,
  CardVariant,
  ContainerWidthToken,
  DesignSettingsDocument,
  SectionSpacingToken,
  SectionSurfaceToken,
  TypographyBodyToken,
  TypographyHeadingToken,
} from "@/lib/cms/design/designContract";
import {
  DESIGN_SETTINGS_CARD_BLOCK_KEYS,
  type ParsedDesignSettings,
  parseDesignSettingsFromSettingsData,
} from "@/lib/cms/design/designContract";

import { analyzeDesign } from "./analyzeDesign";
import { applyAnalyzePolicy } from "./designPolicy";
import type { DesignIssue, DesignIssueCode } from "./types";
import { suggestDesignImprovements } from "./suggestDesignImprovements";

const VARIANTS = new Set<CardVariant>(["default", "glass", "elevated", "flat"]);
const HOVERS = new Set<CardHover>(["none", "lift", "glow"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

/**
 * Fail-closed: only allow known DesignSettings branches (strips unknown keys).
 */
export function sanitizeDesignSettingsPatch(raw: unknown): DesignSettingsDocument | null {
  if (!isPlainObject(raw)) return null;
  const out: DesignSettingsDocument = {};

  if (isPlainObject(raw.card)) {
    const card: Record<string, { variant?: CardVariant; hover?: CardHover }> = {};
    const allowedKeys = new Set<string>(DESIGN_SETTINGS_CARD_BLOCK_KEYS as unknown as string[]);
    for (const [k, v] of Object.entries(raw.card)) {
      if (!allowedKeys.has(k) || !isPlainObject(v)) continue;
      const variant = v.variant;
      const hover = v.hover;
      const entry: { variant?: CardVariant; hover?: CardHover } = {};
      if (typeof variant === "string" && VARIANTS.has(variant as CardVariant)) {
        entry.variant = variant as CardVariant;
      }
      if (typeof hover === "string" && HOVERS.has(hover as CardHover)) {
        entry.hover = hover as CardHover;
      }
      if (entry.variant !== undefined || entry.hover !== undefined) {
        card[k] = entry;
      }
    }
    if (Object.keys(card).length > 0) out.card = card;
  }

  if (isPlainObject(raw.surface)) {
    const s = raw.surface.section;
    if (s === "default" || s === "alt" || s === "contrast") {
      out.surface = { section: s as SectionSurfaceToken };
    }
  }

  if (isPlainObject(raw.spacing)) {
    const s = raw.spacing.section;
    if (s === "tight" || s === "normal" || s === "wide") {
      out.spacing = { section: s as SectionSpacingToken };
    }
  }

  if (isPlainObject(raw.typography)) {
    const o: { heading?: TypographyHeadingToken; body?: TypographyBodyToken } = {};
    const h = raw.typography.heading;
    const b = raw.typography.body;
    if (h === "default" || h === "display") o.heading = h;
    if (b === "default" || b === "compact") o.body = b;
    if (o.heading !== undefined || o.body !== undefined) out.typography = o;
  }

  if (isPlainObject(raw.layout)) {
    const c = raw.layout.container;
    if (c === "normal" || c === "wide" || c === "full") {
      out.layout = { container: c as ContainerWidthToken };
    }
  }

  if (
    out.card == null &&
    out.surface == null &&
    out.spacing == null &&
    out.typography == null &&
    out.layout == null
  ) {
    return null;
  }
  return out;
}

/**
 * Normalize a full or partial `designSettings` blob for persistence (apply/revert).
 * Unknown top-level keys are dropped. Result may be `{}` (defaults at read time).
 */
export function extractDesignSettingsForStorage(raw: unknown): Record<string, unknown> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, unknown> = {};

  if (isPlainObject(raw.card)) {
    const card: Record<string, { variant?: CardVariant; hover?: CardHover }> = {};
    const allowedKeys = new Set<string>([...DESIGN_SETTINGS_CARD_BLOCK_KEYS]);
    for (const [k, v] of Object.entries(raw.card)) {
      if (!allowedKeys.has(k) || !isPlainObject(v)) continue;
      const variant = v.variant;
      const hover = v.hover;
      const entry: { variant?: CardVariant; hover?: CardHover } = {};
      if (typeof variant === "string" && VARIANTS.has(variant as CardVariant)) {
        entry.variant = variant as CardVariant;
      }
      if (typeof hover === "string" && HOVERS.has(hover as CardHover)) {
        entry.hover = hover as CardHover;
      }
      if (entry.variant !== undefined || entry.hover !== undefined) {
        card[k] = entry;
      }
    }
    if (Object.keys(card).length > 0) out.card = card;
  }

  if (isPlainObject(raw.surface)) {
    const s = raw.surface.section;
    if (s === "default" || s === "alt" || s === "contrast") {
      out.surface = { section: s };
    }
  }

  if (isPlainObject(raw.spacing)) {
    const s = raw.spacing.section;
    if (s === "tight" || s === "normal" || s === "wide") {
      out.spacing = { section: s };
    }
  }

  if (isPlainObject(raw.typography)) {
    const o: { heading?: TypographyHeadingToken; body?: TypographyBodyToken } = {};
    const h = raw.typography.heading;
    const b = raw.typography.body;
    if (h === "default" || h === "display") o.heading = h;
    if (b === "default" || b === "compact") o.body = b;
    if (o.heading !== undefined || o.body !== undefined) out.typography = o;
  }

  if (isPlainObject(raw.layout)) {
    const c = raw.layout.container;
    if (c === "normal" || c === "wide" || c === "full") {
      out.layout = { container: c };
    }
  }

  return out;
}

export type DesignOptimizerBlockSummary = {
  id: string;
  type: string;
};

export type DesignOptimizerSuggestionType = "spacing" | "typography" | "surface" | "layout" | "card";

export type DesignOptimizerSuggestion = {
  /** Stable id for logging / apply */
  id: string;
  type: DesignOptimizerSuggestionType;
  /** Short human diff, e.g. "tight → normal" */
  change: string;
  reason: string;
  /** Dot-path for explainability, e.g. spacing.section */
  target?: string;
  /** Minimal DesignSettings patch if this suggestion is applied */
  patch: DesignSettingsDocument;
  /** Which signals triggered the rule */
  signals: string[];
};

export type DesignOptimizerContext = {
  blockCount: number;
  blockTypes: string[];
  hasHero: boolean;
  hasCta: boolean;
  hasPricing: boolean;
  richTextCount: number;
  cardsBlockCount: number;
  designSettings: ParsedDesignSettings;
};

export type DesignOptimizerResult = {
  /** All detected issues (before policy cap on suggestions). */
  issues: DesignIssue[];
  suggestions: DesignOptimizerSuggestion[];
  context: DesignOptimizerContext;
  message: string;
  /** Non–low-risk rows removed when autoApplyMode was true. */
  droppedForAuto?: number;
};

/** Legacy stable ids for API/tests — map from DesignIssueCode. */
const LEGACY_SUGGESTION_ID: Record<DesignIssueCode, string> = {
  SPACING_TIGHT: "spacing_relax_tight",
  SPACING_DENSE_PAGE: "spacing_widen_dense",
  TYPO_HIERARCHY: "typography_heading_display",
  SURFACE_CONTRAST: "surface_contrast_readability",
  LAYOUT_WIDE_CARDS: "layout_wide_card_heavy",
  CARD_CTA_HOVER: "card_cta_hover_lift",
  CARD_PRICING_HOVER: "card_pricing_hover_lift",
};

function legacyTypeFromKey(key: string): DesignOptimizerSuggestion["type"] {
  if (key.startsWith("spacing.")) return "spacing";
  if (key.startsWith("typography.")) return "typography";
  if (key.startsWith("surface.")) return "surface";
  if (key.startsWith("layout.")) return "layout";
  return "card";
}

/**
 * Full pipeline: analyze → suggest → policy cap — legacy suggestion shape for API compatibility.
 */
export function analyzeDesignSettingsOptimizer(input: {
  blocks: DesignOptimizerBlockSummary[];
  settingsDataRoot: unknown;
  locale?: string;
  /** When true, only low-risk suggestions and still capped by policy. */
  autoApplyMode?: boolean;
}): DesignOptimizerResult {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const blocks = Array.isArray(input.blocks) ? input.blocks : [];
  const designSettings = parseDesignSettingsFromSettingsData(input.settingsDataRoot);

  const { issues, context: ctx } = analyzeDesign({
    blocks,
    designSettings,
    locale,
  });
  const { suggestions: raw } = suggestDesignImprovements({ issues, locale });
  const { suggestions: policySuggestions, droppedForAuto } = applyAnalyzePolicy({
    suggestions: raw,
    autoApplyMode: input.autoApplyMode === true,
  });

  const suggestions: DesignOptimizerSuggestion[] = policySuggestions.map((s) => ({
    id: LEGACY_SUGGESTION_ID[s.id],
    type: legacyTypeFromKey(s.key),
    change: isEn ? `${s.from} → ${s.to}` : `${s.from} → ${s.to}`,
    reason: s.reason,
    target: s.key,
    patch: s.patch,
    signals: [s.key, `risk=${s.risk}`, `code=${s.id}`],
  }));

  const context: DesignOptimizerContext = {
    ...ctx,
    designSettings,
  };

  const message =
    suggestions.length === 0
      ? isEn
        ? "No design token changes suggested; current DesignSettings fit this page shape."
        : "Ingen design-token endringer foreslått; nåværende DesignSettings passer sidestrukturen."
      : isEn
        ? `Generated ${suggestions.length} DesignSettings suggestion(s). Each is reversible via snapshot.`
        : `Genererte ${suggestions.length} DesignSettings-forslag. Hvert kan reverseres via øyeblikksbilde.`;

  return {
    issues,
    suggestions,
    context,
    message,
    ...(input.autoApplyMode && droppedForAuto != null && droppedForAuto > 0 ? { droppedForAuto } : {}),
  };
}

/**
 * Merge multiple suggestion patches into one document (order preserved).
 */
export function mergeDesignOptimizerPatches(patches: DesignSettingsDocument[]): DesignSettingsDocument {
  const out: DesignSettingsDocument = {};
  for (const p of patches) {
    if (p.card != null && typeof p.card === "object" && !Array.isArray(p.card)) {
      out.card = { ...(out.card ?? {}), ...p.card };
    }
    if (p.surface != null && typeof p.surface === "object") {
      out.surface = { ...(out.surface ?? {}), ...p.surface };
    }
    if (p.spacing != null && typeof p.spacing === "object") {
      out.spacing = { ...(out.spacing ?? {}), ...p.spacing };
    }
    if (p.typography != null && typeof p.typography === "object") {
      out.typography = { ...(out.typography ?? {}), ...p.typography };
    }
    if (p.layout != null && typeof p.layout === "object") {
      out.layout = { ...(out.layout ?? {}), ...p.layout };
    }
  }
  return out;
}
