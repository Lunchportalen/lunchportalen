/**
 * AI SERP snippet optimizer capability: optimizeSERPSnippet.
 * Optimizes meta title and meta description for SERP display: length limits, word-boundary truncation,
 * optional keyword presence check, and actionable recommendations. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "optimizeSERPSnippet";

const optimizeSERPSnippetCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Optimizes SERP snippet (meta title and meta description): enforces character limits (title ~60, description ~155), truncates at word boundaries, checks keyword presence, and returns suggestions for CTR and clarity.",
  requiredContext: ["title", "description"],
  inputSchema: {
    type: "object",
    description: "SERP snippet optimization input",
    properties: {
      title: { type: "string", description: "Current meta title" },
      description: { type: "string", description: "Current meta description" },
      targetKeyword: { type: "string", description: "Optional target keyword for relevance check" },
      locale: { type: "string", description: "Locale (nb | en) for recommendations" },
    },
    required: ["title", "description"],
  },
  outputSchema: {
    type: "object",
    description: "Optimized SERP snippet",
    required: [
      "suggestedTitle",
      "suggestedDescription",
      "titleLength",
      "descriptionLength",
      "titleWithinLimit",
      "descriptionWithinLimit",
      "recommendations",
      "summary",
    ],
    properties: {
      suggestedTitle: { type: "string" },
      suggestedDescription: { type: "string" },
      titleLength: { type: "number" },
      descriptionLength: { type: "number" },
      titleWithinLimit: { type: "boolean" },
      descriptionWithinLimit: { type: "boolean" },
      recommendations: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(optimizeSERPSnippetCapability);

export type OptimizeSERPSnippetInput = {
  title: string;
  description: string;
  targetKeyword?: string | null;
  locale?: "nb" | "en" | null;
};

export type OptimizeSERPSnippetOutput = {
  suggestedTitle: string;
  suggestedDescription: string;
  titleLength: number;
  descriptionLength: number;
  titleWithinLimit: boolean;
  descriptionWithinLimit: boolean;
  recommendations: string[];
  summary: string;
};

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;

function normalizeWhitespace(s: string): string {
  return (s ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function truncateAtWord(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.5) return slice.slice(0, lastSpace).trim();
  return slice.trim();
}

function containsKeyword(text: string, keyword: string): boolean {
  const k = (keyword ?? "").trim().toLowerCase();
  if (!k) return true;
  return (text ?? "").toLowerCase().includes(k);
}

/**
 * Optimizes meta title and description for SERP display. Deterministic; no external calls.
 */
export function optimizeSERPSnippet(input: OptimizeSERPSnippetInput): OptimizeSERPSnippetOutput {
  const isEn = input.locale === "en";
  const rawTitle = normalizeWhitespace(input.title ?? "");
  const rawDesc = normalizeWhitespace(input.description ?? "");
  const keyword = (input.targetKeyword ?? "").trim();

  const suggestedTitle = truncateAtWord(rawTitle || (isEn ? "Untitled" : "Uten tittel"), TITLE_MAX);
  const suggestedDescription = truncateAtWord(
    rawDesc || (isEn ? "No description." : "Ingen beskrivelse."),
    DESCRIPTION_MAX
  );

  const titleLength = suggestedTitle.length;
  const descriptionLength = suggestedDescription.length;
  const titleWithinLimit = titleLength <= TITLE_MAX;
  const descriptionWithinLimit = descriptionLength <= DESCRIPTION_MAX;

  const recommendations: string[] = [];

  if (rawTitle.length > TITLE_MAX) {
    recommendations.push(
      isEn
        ? `Title was truncated from ${rawTitle.length} to ${TITLE_MAX} chars to avoid SERP cutoff.`
        : `Tittelen ble avkuttet fra ${rawTitle.length} til ${TITLE_MAX} tegn for å unngå avkutting i SERP.`
    );
  }
  if (rawDesc.length > DESCRIPTION_MAX) {
    recommendations.push(
      isEn
        ? `Description was truncated from ${rawDesc.length} to ${DESCRIPTION_MAX} chars.`
        : `Beskrivelsen ble avkuttet fra ${rawDesc.length} til ${DESCRIPTION_MAX} tegn.`
    );
  }

  if (keyword && !containsKeyword(suggestedTitle, keyword)) {
    recommendations.push(
      isEn
        ? `Target keyword "${keyword}" not in title; consider adding it near the start for relevance.`
        : `Målsøkeord «${keyword}» mangler i tittelen; vurder å legge det inn nær starten.`
    );
  }
  if (keyword && !containsKeyword(suggestedDescription, keyword)) {
    recommendations.push(
      isEn
        ? `Target keyword "${keyword}" not in description; include it naturally for relevance.`
        : `Målsøkeord «${keyword}» mangler i beskrivelsen; inkluder det naturlig for relevans.`
    );
  }

  if (descriptionLength < 70 && rawDesc.length > 0) {
    recommendations.push(
      isEn
        ? "Description is short; consider expanding to 120–155 chars with a benefit or CTA."
        : "Beskrivelsen er kort; vurder å utvide til 120–155 tegn med en fordel eller oppfordring."
    );
  }

  if (recommendations.length === 0 && titleLength > 0 && descriptionLength > 0) {
    recommendations.push(
      isEn
        ? "Title and description are within recommended limits. Consider A/B testing different CTAs."
        : "Tittel og beskrivelse er innenfor anbefalte grenser. Vurder A/B-test av ulike oppfordringer."
    );
  }

  const summary = isEn
    ? `Snippet optimized: title ${titleLength}/${TITLE_MAX} chars, description ${descriptionLength}/${DESCRIPTION_MAX} chars. ${titleWithinLimit && descriptionWithinLimit ? "Within limits." : "See recommendations."}`
    : `Snippet optimalisert: tittel ${titleLength}/${TITLE_MAX} tegn, beskrivelse ${descriptionLength}/${DESCRIPTION_MAX} tegn. ${titleWithinLimit && descriptionWithinLimit ? "Innenfor grenser." : "Se anbefalinger."}`;

  return {
    suggestedTitle,
    suggestedDescription,
    titleLength,
    descriptionLength,
    titleWithinLimit,
    descriptionWithinLimit,
    recommendations,
    summary,
  };
}

export { optimizeSERPSnippetCapability, CAPABILITY_NAME };
