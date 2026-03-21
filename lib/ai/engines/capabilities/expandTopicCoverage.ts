/**
 * Semantic topic expansion capability: expandTopicCoverage.
 * Outputs additional sections to improve topical authority.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "expandTopicCoverage";

export type TopicSectionSuggestion = {
  heading: string;
  description: string;
  /** Optional semantic relation (e.g. "how_it_works", "benefits"). */
  relation?: string;
};

const expandTopicCoverageCapability: Capability = {
  name: CAPABILITY_NAME,
  description: "Suggests additional sections to expand topic coverage and improve topical authority. Output is section headings and short descriptions.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Expand topic coverage input",
    properties: {
      topic: { type: "string", description: "Primary topic or page theme" },
      existingHeadings: {
        type: "array",
        items: { type: "string" },
        description: "Existing section headings to avoid duplicating",
      },
      locale: { type: "string", description: "Locale (nb | en)" },
      maxSections: { type: "number", description: "Max suggestions to return (default 6)" },
    },
  },
  outputSchema: {
    type: "object",
    description: "Additional sections for topical authority",
    required: ["additionalSections"],
    properties: {
      additionalSections: {
        type: "array",
        description: "Suggested sections [{ heading, description, relation? }]",
        items: {
          type: "object",
          properties: {
            heading: { type: "string" },
            description: { type: "string" },
            relation: { type: "string" },
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

registerCapability(expandTopicCoverageCapability);

export type ExpandTopicCoverageInput = {
  topic: string;
  existingHeadings?: string[] | null;
  locale?: "nb" | "en";
  maxSections?: number | null;
};

export type ExpandTopicCoverageOutput = {
  additionalSections: TopicSectionSuggestion[];
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeHeading(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Default section suggestions (semantic expansion) for lunch/corporate context. */
const DEFAULT_SECTIONS_NB: TopicSectionSuggestion[] = [
  { heading: "Slik fungerer det", description: "Forklar steg for steg hvordan ordningen fungerer.", relation: "how_it_works" },
  { heading: "Fordeler for arbeidsplassen", description: "Verdi for medarbeidere og ledelse.", relation: "benefits" },
  { heading: "Levering og logistikk", description: "Når og hvordan maten leveres.", relation: "logistics" },
  { heading: "Bærekraft og miljø", description: "Valg som reduserer matsvinn og klimafotavtrykk.", relation: "sustainability" },
  { heading: "Priser og avtaler", description: "Tydelighet på priser og hva som er inkludert.", relation: "pricing" },
  { heading: "Spørsmål og svar", description: "Vanlige spørsmål for rask orientering.", relation: "faq" },
  { heading: "Kontakt oss", description: "Enkel måte å ta kontakt på.", relation: "contact" },
];

const DEFAULT_SECTIONS_EN: TopicSectionSuggestion[] = [
  { heading: "How it works", description: "Explain step by step how the solution works.", relation: "how_it_works" },
  { heading: "Benefits for the workplace", description: "Value for employees and management.", relation: "benefits" },
  { heading: "Delivery and logistics", description: "When and how food is delivered.", relation: "logistics" },
  { heading: "Sustainability and environment", description: "Choices that reduce food waste and carbon footprint.", relation: "sustainability" },
  { heading: "Pricing and agreements", description: "Clarity on prices and what is included.", relation: "pricing" },
  { heading: "FAQ", description: "Common questions for quick orientation.", relation: "faq" },
  { heading: "Contact us", description: "Easy way to get in touch.", relation: "contact" },
];

/**
 * Returns additional section suggestions to improve topical authority.
 * Filters out sections that match existing headings; deterministic from topic and locale.
 */
export function expandTopicCoverage(input: ExpandTopicCoverageInput): ExpandTopicCoverageOutput {
  const topic = safeStr(input.topic);
  const locale = input.locale === "en" ? "en" : "nb";
  const maxSections = typeof input.maxSections === "number" && input.maxSections > 0
    ? Math.min(input.maxSections, 10)
    : 6;

  const existing = new Set(
    (input.existingHeadings ?? [])
      .filter((h): h is string => typeof h === "string")
      .map(normalizeHeading)
  );

  const base = locale === "en" ? DEFAULT_SECTIONS_EN : DEFAULT_SECTIONS_NB;
  const additionalSections: TopicSectionSuggestion[] = [];

  for (const section of base) {
    if (additionalSections.length >= maxSections) break;
    const normalized = normalizeHeading(section.heading);
    if (existing.has(normalized)) continue;
    existing.add(normalized);
    additionalSections.push(section);
  }

  return {
    additionalSections,
  };
}

export { expandTopicCoverageCapability, CAPABILITY_NAME };
