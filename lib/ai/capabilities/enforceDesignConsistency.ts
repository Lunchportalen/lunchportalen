/**
 * Style consistency engine capability: enforceDesignConsistency.
 * Evaluates design samples against a design spec (spacing, color, typography, borderRadius scales).
 * Returns consistent flag, violations with actual/expected, applied rules, and score. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "enforceDesignConsistency";

const enforceDesignConsistencyCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Style consistency engine: from a design spec (allowed spacing, color, typography, borderRadius scales) and samples, evaluates consistency. Returns consistent (boolean), violations (property, actual, expected), applied rules, and consistency score. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Enforce design consistency input",
    properties: {
      designSpec: {
        type: "object",
        description: "Allowed scales and rules",
        properties: {
          spacingScale: { type: "array", items: { type: "string" }, description: "e.g. 0.25rem, 0.5rem, 1rem" },
          colorTokens: { type: "array", items: { type: "string" }, description: "Allowed color tokens or values" },
          typographyScale: { type: "array", items: { type: "string" }, description: "e.g. 0.875rem, 1rem, 1.25rem" },
          borderRadiusScale: { type: "array", items: { type: "string" } },
          requireSingleAccent: { type: "boolean", description: "At most one accent color in samples" },
        },
      },
      samples: {
        type: "array",
        description: "UI samples to check (id, spacing, fontSize, borderRadius, color)",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            spacing: { type: "string" },
            fontSize: { type: "string" },
            borderRadius: { type: "string" },
            color: { type: "string" },
          },
        },
      },
      strict: {
        type: "boolean",
        description: "If true, consistent only when zero violations",
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["designSpec", "samples"],
  },
  outputSchema: {
    type: "object",
    description: "Design consistency enforcement result",
    required: ["consistent", "violations", "appliedRules", "consistencyScore", "summary", "generatedAt"],
    properties: {
      consistent: { type: "boolean" },
      violations: {
        type: "array",
        items: {
          type: "object",
          required: ["property", "actual", "expected", "severity", "suggestion", "elementId"],
          properties: {
            elementId: { type: "string" },
            property: { type: "string" },
            actual: { type: "string" },
            expected: { type: "string" },
            severity: { type: "string", enum: ["high", "medium", "low"] },
            suggestion: { type: "string" },
          },
        },
      },
      appliedRules: { type: "array", items: { type: "string" } },
      consistencyScore: { type: "number", description: "0-100" },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is evaluation only; no design or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(enforceDesignConsistencyCapability);

const DEFAULT_SPACING_REM = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const DEFAULT_TYPOGRAPHY_REM = [0.75, 0.875, 1, 1.125, 1.25, 1.5, 1.875, 2.25];
const DEFAULT_RADIUS_REM = [0, 0.25, 0.5, 0.75, 1];

export type DesignSpecInput = {
  spacingScale?: string[] | null;
  colorTokens?: string[] | null;
  typographyScale?: string[] | null;
  borderRadiusScale?: string[] | null;
  requireSingleAccent?: boolean | null;
};

export type ConsistencySampleInput = {
  id?: string | null;
  spacing?: string | null;
  fontSize?: string | null;
  borderRadius?: string | null;
  color?: string | null;
};

export type EnforceDesignConsistencyInput = {
  designSpec: DesignSpecInput;
  samples: ConsistencySampleInput[];
  strict?: boolean | null;
  locale?: "nb" | "en" | null;
};

export type ConsistencyViolation = {
  elementId: string;
  property: string;
  actual: string;
  expected: string;
  severity: "high" | "medium" | "low";
  suggestion: string;
};

export type EnforceDesignConsistencyOutput = {
  consistent: boolean;
  violations: ConsistencyViolation[];
  appliedRules: string[];
  consistencyScore: number;
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function remValue(s: string | null | undefined): number | null {
  if (s == null || typeof s !== "string") return null;
  const t = safeStr(s);
  const remMatch = t.match(/^([\d.]+)\s*rem$/i);
  if (remMatch) return parseFloat(remMatch[1]);
  const pxMatch = t.match(/^([\d.]+)\s*px$/i);
  if (pxMatch) return parseFloat(pxMatch[1]) / 16;
  return null;
}

function parseScale(scale: string[] | null | undefined): number[] {
  if (!Array.isArray(scale)) return [];
  return scale.map((s) => remValue(s)).filter((n): n is number => n !== null).sort((a, b) => a - b);
}

function nearestOnScale(value: number, scale: number[]): number {
  if (scale.length === 0) return value;
  let best = scale[0];
  for (const s of scale) {
    if (Math.abs(s - value) < Math.abs(best - value)) best = s;
  }
  return best;
}

function isOnScale(value: number, scale: number[], tolerance = 0.02): boolean {
  if (scale.length === 0) return true;
  return scale.some((s) => Math.abs(value - s) < tolerance);
}

function isAccentLike(color: string | null | undefined): boolean {
  if (!color) return false;
  const c = safeStr(color).toLowerCase();
  return /accent|hotpink|hot-pink|#e91e82|#d81b6f|e91e82/i.test(c) || (c.startsWith("#") && c.length >= 6);
}

/**
 * Evaluates samples against design spec. Deterministic; no external calls.
 */
export function enforceDesignConsistency(input: EnforceDesignConsistencyInput): EnforceDesignConsistencyOutput {
  const spec = input.designSpec && typeof input.designSpec === "object" ? input.designSpec : {};
  const samples = Array.isArray(input.samples) ? input.samples : [];
  const strict = input.strict === true;
  const isEn = input.locale === "en";

  const spacingScale = parseScale(spec.spacingScale?.length ? spec.spacingScale : DEFAULT_SPACING_REM.map((r) => `${r}rem`));
  const typographyScale = parseScale(spec.typographyScale?.length ? spec.typographyScale : DEFAULT_TYPOGRAPHY_REM.map((r) => `${r}rem`));
  const radiusScale = parseScale(spec.borderRadiusScale?.length ? spec.borderRadiusScale : DEFAULT_RADIUS_REM.map((r) => `${r}rem`));
  const colorTokens = Array.isArray(spec.colorTokens) ? spec.colorTokens.map(safeStr).filter(Boolean) : [];
  const requireSingleAccent = spec.requireSingleAccent === true;

  const violations: ConsistencyViolation[] = [];
  const appliedRules: string[] = [];

  if (spacingScale.length > 0) appliedRules.push("spacing_on_scale");
  if (typographyScale.length > 0) appliedRules.push("typography_on_scale");
  if (radiusScale.length > 0) appliedRules.push("border_radius_on_scale");
  if (colorTokens.length > 0) appliedRules.push("color_from_tokens");
  if (requireSingleAccent) appliedRules.push("single_accent_only");

  let accentCount = 0;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (!s || typeof s !== "object") continue;
    const elementId = safeStr(s.id) || `#${i}`;

    const spacingRem = remValue(s.spacing);
    if (spacingRem !== null && spacingScale.length > 0 && !isOnScale(spacingRem, spacingScale)) {
      const expected = nearestOnScale(spacingRem, spacingScale);
      violations.push({
        elementId,
        property: "spacing",
        actual: safeStr(s.spacing) || String(spacingRem),
        expected: `${expected}rem`,
        severity: "medium",
        suggestion: isEn ? `Use spacing from scale: ${expected}rem.` : `Bruk spacing fra skala: ${expected}rem.`,
      });
    }

    const fontSizeRem = remValue(s.fontSize);
    if (fontSizeRem !== null && typographyScale.length > 0 && !isOnScale(fontSizeRem, typographyScale)) {
      const expected = nearestOnScale(fontSizeRem, typographyScale);
      violations.push({
        elementId,
        property: "fontSize",
        actual: safeStr(s.fontSize) || String(fontSizeRem),
        expected: `${expected}rem`,
        severity: "medium",
        suggestion: isEn ? `Use typography scale: ${expected}rem.` : `Bruk type-skala: ${expected}rem.`,
      });
    }

    const radiusRem = remValue(s.borderRadius);
    if (radiusRem !== null && radiusScale.length > 0 && !isOnScale(radiusRem, radiusScale)) {
      const expected = nearestOnScale(radiusRem, radiusScale);
      violations.push({
        elementId,
        property: "borderRadius",
        actual: safeStr(s.borderRadius) || String(radiusRem),
        expected: `${expected}rem`,
        severity: "low",
        suggestion: isEn ? `Use radius from scale: ${expected}rem.` : `Bruk radius fra skala: ${expected}rem.`,
      });
    }

    const color = safeStr(s.color);
    if (color && colorTokens.length > 0) {
      const normalized = color.toLowerCase();
      const tokenMatch = colorTokens.some((t) => normalized.includes(t.toLowerCase()) || t.toLowerCase().includes(normalized));
      if (!tokenMatch) {
        violations.push({
          elementId,
          property: "color",
          actual: color,
          expected: colorTokens[0] ?? "token from spec",
          severity: "high",
          suggestion: isEn ? "Use color from design tokens." : "Bruk farge fra design-tokens.",
        });
      }
    }

    if (isAccentLike(s.color)) accentCount++;
  }

  if (requireSingleAccent && accentCount > 1) {
    violations.push({
      elementId: "global",
      property: "accent",
      actual: `${accentCount} accent usages`,
      expected: "1 accent only",
      severity: "high",
      suggestion: isEn ? "Use exactly one accent (e.g. one primary CTA). AGENTS.md F6." : "Bruk nøyaktig én accent (f.eks. én primær CTA). AGENTS.md F6.",
    });
  }

  const highCount = violations.filter((v) => v.severity === "high").length;
  const totalChecks = samples.length * 4 + (requireSingleAccent ? 1 : 0);
  const violationCount = violations.length;
  const consistencyScore = totalChecks > 0 ? Math.max(0, Math.round(100 - (violationCount / Math.max(totalChecks, 1)) * 50) - highCount * 10) : 100;
  const consistent = strict ? violationCount === 0 : highCount === 0;

  const summary = isEn
    ? `Design consistency: ${consistent ? "passed" : "violations"}. Score ${consistencyScore}/100. ${violations.length} violation(s), ${appliedRules.length} rule(s) applied.`
    : `Designkonsistens: ${consistent ? "bestått" : "brudd"}. Score ${consistencyScore}/100. ${violations.length} brudd, ${appliedRules.length} regel(er) anvendt.`;

  return {
    consistent,
    violations,
    appliedRules,
    consistencyScore: Math.min(100, Math.max(0, consistencyScore)),
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { enforceDesignConsistencyCapability, CAPABILITY_NAME };
