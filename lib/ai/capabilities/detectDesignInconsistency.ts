/**
 * AI UI consistency checker capability: detectDesignInconsistency.
 * Detects design inconsistencies: mixed spacing units, font sizes off scale, multiple accent colors,
 * inconsistent border radius. Returns issues, suggestions, and a consistency score. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectDesignInconsistency";

const detectDesignInconsistencyCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Detects UI design inconsistencies: mixed spacing units (px vs rem), font sizes not from scale, multiple accent colors, inconsistent border radius. Returns issues, suggestions, and consistency score.",
  requiredContext: ["samples"],
  inputSchema: {
    type: "object",
    description: "Design consistency check input",
    properties: {
      samples: {
        type: "array",
        description: "UI style samples to compare (spacing, fontSize, borderRadius, color)",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "Component or element id" },
            spacing: { type: "string", description: "e.g. 1rem, 16px" },
            fontSize: { type: "string", description: "e.g. 1rem, 14px" },
            borderRadius: { type: "string", description: "e.g. 0.5rem, 8px" },
            color: { type: "string", description: "e.g. accent, primary, #e91e82" },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["samples"],
  },
  outputSchema: {
    type: "object",
    description: "Design inconsistency result",
    required: ["consistencyScore", "inconsistencies", "suggestions", "summary"],
    properties: {
      consistencyScore: { type: "number", description: "0–100 (higher = more consistent)" },
      inconsistencies: {
        type: "array",
        items: {
          type: "object",
          required: ["type", "message", "occurrences", "suggestion"],
          properties: {
            type: { type: "string" },
            message: { type: "string" },
            occurrences: { type: "array", items: { type: "string" } },
            suggestion: { type: "string" },
          },
        },
      },
      suggestions: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is detection only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(detectDesignInconsistencyCapability);

export type DesignSample = {
  id?: string | null;
  spacing?: string | null;
  fontSize?: string | null;
  borderRadius?: string | null;
  color?: string | null;
};

export type DetectDesignInconsistencyInput = {
  samples: DesignSample[];
  locale?: "nb" | "en" | null;
};

export type DesignInconsistency = {
  type: string;
  message: string;
  occurrences: string[];
  suggestion: string;
};

export type DetectDesignInconsistencyOutput = {
  consistencyScore: number;
  inconsistencies: DesignInconsistency[];
  suggestions: string[];
  summary: string;
};

const SPACING_SCALE_REM = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const FONT_SCALE_REM = [0.75, 0.875, 1, 1.125, 1.25, 1.5, 1.875, 2.25];
const ACCENT_ALIASES = ["accent", "hotpink", "hot-pink", "#e91e82", "#d81b6f", "e91e82"];

function remValue(s: string | null | undefined): number | null {
  if (s == null || typeof s !== "string") return null;
  const t = s.trim();
  const remMatch = t.match(/^([\d.]+)\s*rem$/i);
  if (remMatch) return parseFloat(remMatch[1]);
  const pxMatch = t.match(/^([\d.]+)\s*px$/i);
  if (pxMatch) return parseFloat(pxMatch[1]) / 16;
  return null;
}

function isOnScale(value: number, scale: number[], tolerance = 0.01): boolean {
  return scale.some((s) => Math.abs(value - s) < tolerance || Math.abs(value - s / 16) < tolerance);
}

function isAccentLike(color: string | null | undefined): boolean {
  if (color == null || typeof color !== "string") return false;
  const c = color.trim().toLowerCase();
  if (ACCENT_ALIASES.some((a) => c.includes(a.toLowerCase()))) return true;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) {
    const hex = c.replace("#", "");
    const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
    const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
    const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
    return r > 200 && g < 80 && b > 100;
  }
  return false;
}

/**
 * Detects design inconsistencies across UI samples. Deterministic; no external calls.
 */
export function detectDesignInconsistency(input: DetectDesignInconsistencyInput): DetectDesignInconsistencyOutput {
  const isEn = input.locale === "en";
  const safeSamples = Array.isArray(input.samples)
    ? input.samples
        .filter((s): s is DesignSample => s != null && typeof s === "object")
        .map((s, i) => ({
          id: (typeof s.id === "string" ? s.id : "").trim() || `item-${i}`,
          spacing: typeof s.spacing === "string" ? s.spacing : undefined,
          fontSize: typeof s.fontSize === "string" ? s.fontSize : undefined,
          borderRadius: typeof s.borderRadius === "string" ? s.borderRadius : undefined,
          color: typeof s.color === "string" ? s.color : undefined,
        }))
    : [];

  const inconsistencies: DesignInconsistency[] = [];

  const spacingValues = safeSamples.map((s) => s.spacing).filter(Boolean) as string[];
  const hasRem = spacingValues.some((v) => /rem/i.test(v));
  const hasPx = spacingValues.some((v) => /px/i.test(v));
  if (hasRem && hasPx && spacingValues.length >= 2) {
    const withPx = safeSamples.filter((s) => s.spacing && /px/i.test(s.spacing)).map((s) => s.id);
    inconsistencies.push({
      type: "mixed_spacing_units",
      message: isEn ? "Mixed spacing units (rem and px); use one unit system." : "Blandede avstandsenheter (rem og px); bruk ett enhetssystem.",
      occurrences: withPx,
      suggestion: isEn ? "Use rem for spacing (e.g. 1rem, 1.5rem) for consistency and accessibility." : "Bruk rem for avstand (f.eks. 1rem, 1.5rem) for konsistens og tilgjengelighet.",
    });
  }

  const fontRemValues = safeSamples.map((s) => remValue(s.fontSize)).filter((v): v is number => v != null);
  const offScaleFonts = safeSamples.filter((s) => {
    const r = remValue(s.fontSize);
    return r != null && !isOnScale(r, FONT_SCALE_REM);
  });
  if (offScaleFonts.length > 0) {
    inconsistencies.push({
      type: "font_off_scale",
      message: isEn ? "Font sizes not from typography scale." : "Skriftstørrelser utenfor typografiskala.",
      occurrences: offScaleFonts.map((s) => s.id),
      suggestion: isEn ? "Use scale: 0.75rem, 0.875rem, 1rem, 1.125rem, 1.25rem, 1.5rem, 1.875rem, 2.25rem." : "Bruk skala: 0.75rem, 0.875rem, 1rem, 1.125rem, 1.25rem, 1.5rem, 1.875rem, 2.25rem.",
    });
  }

  const accentSamples = safeSamples.filter((s) => isAccentLike(s.color));
  if (accentSamples.length > 1) {
    inconsistencies.push({
      type: "multiple_accent_usage",
      message: isEn ? "Accent color used in multiple places; one primary action only." : "Accentfarge brukt flere steder; én primær handling kun.",
      occurrences: accentSamples.map((s) => s.id),
      suggestion: isEn ? "Restrict accent (e.g. hot pink) to exactly one primary CTA per view." : "Begrens accent (f.eks. hot pink) til nøyaktig én primær CTA per visning.",
    });
  }

  const radiusValues = safeSamples.map((s) => s.borderRadius).filter(Boolean) as string[];
  const uniqueRadius = [...new Set(radiusValues.map((r) => r.trim()))];
  if (uniqueRadius.length > 3 && radiusValues.length >= 4) {
    inconsistencies.push({
      type: "inconsistent_border_radius",
      message: isEn ? "Many different border-radius values; use a small set of tokens." : "Mange ulike border-radius-verdier; bruk et lite sett med tokens.",
      occurrences: safeSamples.filter((s) => s.borderRadius).map((s) => s.id),
      suggestion: isEn ? "Use 2–3 radius tokens (e.g. 0.25rem, 0.5rem, 9999px for pill)." : "Bruk 2–3 radius-tokens (f.eks. 0.25rem, 0.5rem, 9999px for pill).",
    });
  }

  const suggestions: string[] = [];
  if (inconsistencies.length === 0 && safeSamples.length > 0) {
    suggestions.push(isEn ? "Samples look consistent; keep using the same spacing and type scale." : "Prøvene ser konsistente ut; fortsett med samme avstands- og typeskala.");
  } else {
    inconsistencies.forEach((i) => suggestions.push(i.suggestion));
  }

  const issueCount = inconsistencies.length;
  const maxDeduction = Math.min(25 * issueCount, 60);
  const consistencyScore = Math.max(0, Math.min(100, 100 - maxDeduction));

  const summary = isEn
    ? `Design consistency: ${consistencyScore}/100. ${issueCount} inconsistency type(s) found across ${safeSamples.length} sample(s).`
    : `Designkonsistens: ${consistencyScore}/100. ${issueCount} inkonsistenstype(r) funnet på ${safeSamples.length} prøve(r).`;

  return {
    consistencyScore: Math.round(consistencyScore),
    inconsistencies,
    suggestions: [...new Set(suggestions)],
    summary,
  };
}

export { detectDesignInconsistencyCapability, CAPABILITY_NAME };
