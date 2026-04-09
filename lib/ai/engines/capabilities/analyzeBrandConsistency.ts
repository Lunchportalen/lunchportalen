/**
 * AI brand alignment capability: analyzeBrandConsistency.
 * Analyzes content and style for brand consistency: tone (calm, no hype), accent usage (one primary only),
 * logo and typography rules. Returns score, issues, and suggestions. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "analyzeBrandConsistency";

const analyzeBrandConsistencyCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Analyzes brand consistency: tone (calm, professional, no hype), accent color usage (one primary action only), logo source, typography (Inter for headings). Returns score, issues, and suggestions.",
  requiredContext: ["content"],
  inputSchema: {
    type: "object",
    description: "Brand consistency input",
    properties: {
      content: {
        type: "object",
        description: "Content and style to analyze",
        properties: {
          copy: { type: "string", description: "Sample copy or concatenated text" },
          blocks: {
            type: "array",
            description: "Optional: blocks with heading/body for tone check",
            items: { type: "object", properties: { heading: { type: "string" }, body: { type: "string" } } },
          },
          accentCount: { type: "number", description: "Number of elements using accent color (should be 0 or 1)" },
          hasLogo: { type: "boolean", description: "Whether logo is present from /public/brand" },
          logoSource: { type: "string", description: "Logo path or source (e.g. /public/brand/...)" },
          fontHeading: { type: "string", description: "Heading font (should be Inter)" },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["content"],
  },
  outputSchema: {
    type: "object",
    description: "Brand consistency result",
    required: ["consistencyScore", "issues", "suggestions", "summary"],
    properties: {
      consistencyScore: { type: "number", description: "0–100 (higher = more aligned)" },
      issues: {
        type: "array",
        items: {
          type: "object",
          required: ["type", "message", "suggestion"],
          properties: {
            type: { type: "string" },
            message: { type: "string" },
            suggestion: { type: "string" },
          },
        },
      },
      suggestions: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is analysis only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(analyzeBrandConsistencyCapability);

export type BrandConsistencyContentInput = {
  copy?: string | null;
  blocks?: Array<{ heading?: string | null; body?: string | null }> | null;
  accentCount?: number | null;
  hasLogo?: boolean | null;
  logoSource?: string | null;
  fontHeading?: string | null;
};

export type AnalyzeBrandConsistencyInput = {
  content: BrandConsistencyContentInput;
  locale?: "nb" | "en" | null;
};

export type BrandConsistencyIssue = {
  type: string;
  message: string;
  suggestion: string;
};

export type AnalyzeBrandConsistencyOutput = {
  consistencyScore: number;
  issues: BrandConsistencyIssue[];
  suggestions: string[];
  summary: string;
};

const HYPE_WORDS_EN = [
  "revolutionary", "game-changer", "disrupt", "best-in-class", "world-class",
  "cutting-edge", "synergy", "leverage", "paradigm", "guaranteed results",
  "limited time", "act now", "don't miss", "exclusive", "amazing deal",
];
const HYPE_WORDS_NB = [
  "revolusjonerende", "spillendrende", "banebrytende", "verdensklasse",
  "eksklusiv", "begrenset tid", "handl nå", "mis ikke", "utrolig tilbud",
];

const CALM_SIGNALS_EN = ["clear", "simple", "reliable", "support", "overview", "manage"];
const CALM_SIGNALS_NB = ["tydelig", "enkelt", "pålitelig", "støtte", "oversikt", "administrer"];

function extractText(content: BrandConsistencyContentInput): string {
  const copy = (content.copy ?? "").trim();
  if (copy) return copy;
  const blocks = Array.isArray(content.blocks) ? content.blocks : [];
  const parts: string[] = [];
  for (const b of blocks) {
    const h = (b?.heading ?? "").trim();
    const body = (b?.body ?? "").trim();
    if (h) parts.push(h);
    if (body) parts.push(body);
  }
  return parts.join(" ").toLowerCase();
}

/**
 * Analyzes brand consistency. Deterministic; no external calls.
 */
export function analyzeBrandConsistency(input: AnalyzeBrandConsistencyInput): AnalyzeBrandConsistencyOutput {
  const isEn = input.locale === "en";
  const content = input.content && typeof input.content === "object" ? input.content : {};
  const issues: BrandConsistencyIssue[] = [];

  const text = extractText(content);
  const hypeWords = isEn ? HYPE_WORDS_EN : HYPE_WORDS_NB;
  const hypeFound = hypeWords.filter((w) => text.includes(w.toLowerCase()));
  if (hypeFound.length > 0) {
    issues.push({
      type: "tone_hype",
      message: isEn
        ? `Hype or buzzword phrasing detected: ${hypeFound.slice(0, 3).join(", ")}. Brand tone is calm and professional.`
        : `Hype eller buzzord oppdaget: ${hypeFound.slice(0, 3).join(", ")}. Merkestemme er rolig og profesjonell.`,
      suggestion: isEn
        ? "Replace with calm, factual language; avoid superlatives and urgency pressure."
        : "Erstatt med rolig, faktabasert språk; unngå superlativer og hastverk.",
    });
  }

  const accentCount = typeof content.accentCount === "number" && !Number.isNaN(content.accentCount) ? content.accentCount : null;
  if (accentCount !== null && accentCount > 1) {
    issues.push({
      type: "accent_overuse",
      message: isEn
        ? "Accent color used on more than one primary action; exactly one per view."
        : "Accentfarge brukt på mer enn én primær handling; nøyaktig én per visning.",
      suggestion: isEn
        ? "Restrict hot-pink/accent to a single primary CTA; use neutral for secondary actions."
        : "Begrens hot-pink/accent til én primær CTA; bruk nøytral for sekundære handlinger.",
    });
  }

  const logoSource = (content.logoSource ?? "").trim().toLowerCase();
  const validLogoSource = logoSource.length > 0 && (logoSource.includes("/public/brand") || logoSource.includes("public/brand"));
  const hasLogoIndicated = content.hasLogo === true || logoSource.length > 0;
  if (hasLogoIndicated && !validLogoSource) {
    issues.push({
      type: "logo_source",
      message: isEn
        ? "Logo should be from /public/brand; text-only branding is not allowed in production."
        : "Logo skal være fra /public/brand; kun tekst som merkevare er ikke tillatt i produksjon.",
      suggestion: isEn
        ? "Use /public/brand/LP-logo-uten-bakgrunn.png; ensure no layout shift."
        : "Bruk /public/brand/LP-logo-uten-bakgrunn.png; unngå layout-shift.",
    });
  }

  const fontHeading = (content.fontHeading ?? "").trim().toLowerCase();
  if (fontHeading.length > 0 && !fontHeading.includes("inter")) {
    issues.push({
      type: "typography_heading",
      message: isEn
        ? "Headings must use Inter for enterprise clarity."
        : "Overskrifter skal bruke Inter for enterprise-klarhet.",
      suggestion: isEn
        ? "Set heading font family to Inter (or system fallback)."
        : "Sett overskriftfont til Inter (eller system fallback).",
    });
  }

  const calmWords = isEn ? CALM_SIGNALS_EN : CALM_SIGNALS_NB;
  const hasCalmSignals = calmWords.some((w) => text.includes(w.toLowerCase()));
  const suggestions: string[] = [];
  if (issues.length === 0) {
    suggestions.push(isEn ? "Brand alignment looks good; keep tone calm and accent to one primary action." : "Merkevarealignering ser bra ut; behold rolig tone og accent på én primær handling.");
  } else {
    issues.forEach((i) => suggestions.push(i.suggestion));
  }
  if (text.length > 0 && !hasCalmSignals && hypeFound.length === 0) {
    suggestions.push(isEn ? "Consider adding calm, professional cues (e.g. clear, simple, reliable)." : "Vurder å legge til rolige, profesjonelle signaler (f.eks. tydelig, enkelt, pålitelig).");
  }

  const deduction = Math.min(issues.length * 20, 80);
  const consistencyScore = Math.max(0, Math.min(100, 100 - deduction));

  const summary = isEn
    ? `Brand consistency: ${consistencyScore}/100. ${issues.length} issue(s) found.`
    : `Merkeverkonsistens: ${consistencyScore}/100. ${issues.length} problem(er) funnet.`;

  return {
    consistencyScore,
    issues,
    suggestions: [...new Set(suggestions)],
    summary,
  };
}

export { analyzeBrandConsistencyCapability, CAPABILITY_NAME };
