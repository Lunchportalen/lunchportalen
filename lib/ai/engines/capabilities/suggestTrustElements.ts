/**
 * Trust-signal suggestion engine capability: suggestTrustElements.
 * Examples: testimonials, guarantees, stats, case studies.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "suggestTrustElements";

export type TrustElementType = "testimonials" | "guarantees" | "stats" | "case_studies";

export type TrustElementSuggestion = {
  type: TrustElementType;
  label: string;
  description: string;
  /** Placement hint for editor. */
  placementHint: string;
};

const suggestTrustElementsCapability: Capability = {
  name: CAPABILITY_NAME,
  description: "Suggests trust elements to strengthen conversion: testimonials, guarantees, stats, case studies. Returns type, label, description, and placement hint.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Suggest trust elements input",
    properties: {
      context: { type: "string", description: "Page or section context" },
      existingTypes: {
        type: "array",
        items: { type: "string" },
        description: "Trust element types already present (to avoid duplicates)",
      },
      locale: { type: "string", description: "Locale (nb | en)" },
    },
  },
  outputSchema: {
    type: "object",
    description: "Trust element suggestions",
    required: ["suggestions"],
    properties: {
      suggestions: {
        type: "array",
        description: "Array of { type, label, description, placementHint }",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            label: { type: "string" },
            description: { type: "string" },
            placementHint: { type: "string" },
          },
        },
      },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is suggestions only; no content mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestTrustElementsCapability);

export type SuggestTrustElementsInput = {
  context?: string | null;
  existingTypes?: string[] | null;
  locale?: "nb" | "en";
};

export type SuggestTrustElementsOutput = {
  suggestions: TrustElementSuggestion[];
};

const ELEMENTS_NB: TrustElementSuggestion[] = [
  {
    type: "testimonials",
    label: "Tilbakemeldinger",
    description: "Kundeuttalelser eller sitater som bygger troverdighet.",
    placementHint: "Etter verdier/fordeler eller før CTA.",
  },
  {
    type: "guarantees",
    label: "Garantier",
    description: "Tydelige løfter (f.eks. «Ingen binding», «Prisgaranti»).",
    placementHint: "Nær CTA eller i egen seksjon.",
  },
  {
    type: "stats",
    label: "Tall og statistikk",
    description: "Konkrete tall (antall kunder, år i drift, redusert svinn).",
    placementHint: "I hero eller rett under introduksjon.",
  },
  {
    type: "case_studies",
    label: "Casestudier",
    description: "Korte case-eksempler som viser resultater.",
    placementHint: "Etter hovedinnhold, før CTA.",
  },
];

const ELEMENTS_EN: TrustElementSuggestion[] = [
  {
    type: "testimonials",
    label: "Testimonials",
    description: "Customer quotes or short reviews to build credibility.",
    placementHint: "After value props or before CTA.",
  },
  {
    type: "guarantees",
    label: "Guarantees",
    description: "Clear promises (e.g. no commitment, price guarantee).",
    placementHint: "Near CTA or in a dedicated section.",
  },
  {
    type: "stats",
    label: "Stats and numbers",
    description: "Concrete numbers (customers, years in operation, waste reduced).",
    placementHint: "In hero or right below intro.",
  },
  {
    type: "case_studies",
    label: "Case studies",
    description: "Short case examples showing outcomes.",
    placementHint: "After main content, before CTA.",
  },
];

function normalizeType(t: unknown): string {
  return typeof t === "string" ? t.trim().toLowerCase() : "";
}

/**
 * Returns trust element suggestions (testimonials, guarantees, stats, case studies).
 * Filters out types already present when existingTypes is provided.
 */
export function suggestTrustElements(input: SuggestTrustElementsInput): SuggestTrustElementsOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const existing = new Set(
    (input.existingTypes ?? [])
      .filter((x): x is string => typeof x === "string")
      .map(normalizeType)
  );

  const base = locale === "en" ? ELEMENTS_EN : ELEMENTS_NB;
  const suggestions = base.filter((s) => !existing.has(s.type));

  return {
    suggestions,
  };
}

export { suggestTrustElementsCapability, CAPABILITY_NAME };
