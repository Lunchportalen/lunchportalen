/**
 * Ad copy optimizer capability: optimizeAdCopy.
 * Optimizes ad copy (headline, body, CTA) for platform limits, clarity, and tone.
 * Returns variants, suggestions, character counts, and compliance notes. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "optimizeAdCopy";

const optimizeAdCopyCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Optimizes ad copy for platform limits and best practices. Input: headline, body, CTA, platform. Returns optimized variants, suggestions, character counts vs limits, and compliance notes. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Ad copy optimization input",
    properties: {
      headline: { type: "string", description: "Primary headline" },
      body: { type: "string", description: "Ad description or body" },
      cta: { type: "string", description: "Call to action" },
      platform: {
        type: "string",
        enum: ["google", "meta", "linkedin", "generic"],
        description: "Ad platform",
      },
      tone: { type: "string", enum: ["professional", "friendly", "urgent"] },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["headline"],
  },
  outputSchema: {
    type: "object",
    description: "Ad copy optimization result",
    required: ["headlineVariants", "suggestions", "characterCounts", "summary", "generatedAt"],
    properties: {
      headlineVariants: { type: "array", items: { type: "string" } },
      bodyVariants: { type: "array", items: { type: "string" } },
      ctaVariants: { type: "array", items: { type: "string" } },
      suggestions: { type: "array", items: { type: "string" } },
      characterCounts: {
        type: "object",
        properties: {
          headline: { type: "object", properties: { current: { type: "number" }, limit: { type: "number" }, ok: { type: "boolean" } } },
          body: { type: "object", properties: { current: { type: "number" }, limit: { type: "number" }, ok: { type: "boolean" } } },
          cta: { type: "object", properties: { current: { type: "number" }, limit: { type: "number" }, ok: { type: "boolean" } } },
        },
      },
      complianceNotes: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is suggestions/variants only; no ad serving or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(optimizeAdCopyCapability);

const PLATFORM_LIMITS: Record<string, { headline: number; body: number; cta: number }> = {
  google: { headline: 30, body: 90, cta: 25 },
  meta: { headline: 40, body: 125, cta: 25 },
  linkedin: { headline: 70, body: 150, cta: 25 },
  generic: { headline: 60, body: 200, cta: 30 },
};

const HYPE_WORDS_EN = ["best", "guaranteed", "free", "instant", "miracle", "secret", "revolutionary", "ultimate"];
const HYPE_WORDS_NB = ["best", "garantert", "gratis", "øyeblikkelig", "revolusjonerende", "ultimate"];

function safeStr(v: unknown): string {
  return typeof v === "string" ? String(v).trim() : "";
}

function truncate(s: string, max: number, suffix = ""): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - suffix.length);
  const last = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("."));
  if (last > max * 0.5) return cut.slice(0, last).trim() + suffix;
  return cut.trim() + suffix;
}

export type OptimizeAdCopyInput = {
  headline: string;
  body?: string | null;
  cta?: string | null;
  platform?: "google" | "meta" | "linkedin" | "generic" | null;
  tone?: "professional" | "friendly" | "urgent" | null;
  locale?: "nb" | "en" | null;
};

export type CharacterCount = { current: number; limit: number; ok: boolean };

export type OptimizeAdCopyOutput = {
  headlineVariants: string[];
  bodyVariants: string[];
  ctaVariants: string[];
  suggestions: string[];
  characterCounts: {
    headline: CharacterCount;
    body: CharacterCount;
    cta: CharacterCount;
  };
  complianceNotes: string[];
  summary: string;
  generatedAt: string;
};

/**
 * Optimizes ad copy for platform and tone. Deterministic; no external calls.
 */
export function optimizeAdCopy(input: OptimizeAdCopyInput): OptimizeAdCopyOutput {
  const isEn = input.locale === "en";
  const headline = safeStr(input.headline);
  const body = safeStr(input.body);
  const cta = safeStr(input.cta);
  const platform = input.platform && PLATFORM_LIMITS[input.platform] ? input.platform : "generic";
  const limits = PLATFORM_LIMITS[platform];

  const headlineLen = headline.length;
  const bodyLen = body.length;
  const ctaLen = cta.length;

  const characterCounts = {
    headline: { current: headlineLen, limit: limits.headline, ok: headlineLen <= limits.headline },
    body: { current: bodyLen, limit: limits.body, ok: bodyLen <= limits.body },
    cta: { current: ctaLen, limit: limits.cta, ok: ctaLen <= limits.cta },
  };

  const headlineVariants: string[] = [headline];
  if (headlineLen > limits.headline) {
    headlineVariants.push(truncate(headline, limits.headline, "…"));
  }
  if (headline && headlineLen < limits.headline * 0.8 && headline.indexOf(" ") >= 0) {
    const firstPart = headline.split(/[.!?]/)[0]?.trim() ?? headline;
    if (firstPart !== headline) headlineVariants.push(firstPart);
  }

  const bodyVariants: string[] = body ? [body] : [];
  if (body && bodyLen > limits.body) {
    bodyVariants.push(truncate(body, limits.body, "…"));
  }

  const ctaVariants: string[] = cta ? [cta] : [];
  const defaultCta = isEn ? "Learn more" : "Les mer";
  if (!cta) ctaVariants.push(defaultCta);
  else if (ctaLen > limits.cta) ctaVariants.push(truncate(cta, limits.cta, ""));

  const suggestions: string[] = [];
  if (headlineLen > limits.headline) {
    suggestions.push(isEn ? `Shorten headline to ${limits.headline} chars for ${platform}.` : `Forkort overskrift til ${limits.headline} tegn for ${platform}.`);
  }
  if (body && bodyLen > limits.body) {
    suggestions.push(isEn ? `Shorten body to ${limits.body} chars.` : `Forkort brødtekst til ${limits.body} tegn.`);
  }
  if (!cta) {
    suggestions.push(isEn ? "Add a clear CTA (e.g. Learn more, Sign up)." : "Legg til tydelig CTA (f.eks. Les mer, Registrer deg).");
  }
  if (cta && ctaLen > limits.cta) {
    suggestions.push(isEn ? `Shorten CTA to ${limits.cta} chars.` : `Forkort CTA til ${limits.cta} tegn.`);
  }

  const hypeWords = isEn ? HYPE_WORDS_EN : HYPE_WORDS_NB;
  const lowerHeadline = headline.toLowerCase();
  const lowerBody = body.toLowerCase();
  const foundHype = hypeWords.filter((w) => lowerHeadline.includes(w) || lowerBody.includes(w));
  if (foundHype.length > 0 && input.tone === "professional") {
    suggestions.push(isEn ? "Consider toning down superlatives for a calmer, professional tone (AGENTS.md S7)." : "Vurder å dempe superlativer for roligere, profesjonell tone (AGENTS.md S7).");
  }

  const complianceNotes: string[] = [];
  complianceNotes.push(isEn ? "Avoid misleading or exaggerated claims." : "Unngå villedende eller overdrevne påstander.");
  complianceNotes.push(isEn ? "Ensure CTA matches landing page intent." : "Sørg for at CTA matcher landingssidens intensjon.");

  const summary = isEn
    ? `Ad copy optimized for ${platform}. Headline ${characterCounts.headline.ok ? "OK" : "over limit"}, body ${characterCounts.body.ok ? "OK" : "over limit"}, CTA ${characterCounts.cta.ok ? "OK" : "over limit"}. ${suggestions.length} suggestion(s).`
    : `Annonsekopi optimalisert for ${platform}. Overskrift ${characterCounts.headline.ok ? "OK" : "over grense"}, brødtekst ${characterCounts.body.ok ? "OK" : "over grense"}, CTA ${characterCounts.cta.ok ? "OK" : "over grense"}. ${suggestions.length} forslag.`;

  return {
    headlineVariants,
    bodyVariants,
    ctaVariants,
    suggestions,
    characterCounts,
    complianceNotes,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { optimizeAdCopyCapability, CAPABILITY_NAME };
