/**
 * Headline generator capability: generateHeadlineVariants.
 * Returns 5 headline options ranked by conversion probability.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateHeadlineVariants";

export type HeadlineVariant = {
  headline: string;
  /** Conversion probability rank 1–5 (1 = highest). */
  conversionRank: number;
  /** Score 0–100 for conversion probability (deterministic heuristic). */
  conversionScore: number;
};

const generateHeadlineVariantsCapability: Capability = {
  name: CAPABILITY_NAME,
  description: "Generates 5 headline options ranked by conversion probability. Suitable for hero or CTA titles.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Generate headline variants input",
    properties: {
      topic: { type: "string", description: "Page or product topic" },
      audience: { type: "string", description: "Target audience" },
      locale: { type: "string", description: "Locale (nb | en)" },
    },
  },
  outputSchema: {
    type: "object",
    description: "5 headline options ranked by conversion probability",
    required: ["headlines"],
    properties: {
      headlines: {
        type: "array",
        description: "Array of { headline, conversionRank, conversionScore }",
        items: {
          type: "object",
          properties: {
            headline: { type: "string" },
            conversionRank: { type: "number" },
            conversionScore: { type: "number" },
          },
        },
      },
    },
  },
  safetyConstraints: [
    { code: "plain_text_only", description: "Headlines are plain text; no HTML.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateHeadlineVariantsCapability);

export type GenerateHeadlineVariantsInput = {
  topic?: string | null;
  audience?: string | null;
  locale?: "nb" | "en";
};

export type GenerateHeadlineVariantsOutput = {
  headlines: HeadlineVariant[];
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Heuristic conversion score: length in range 20–60 chars, no all-caps. 0–100. */
function conversionHeuristic(headline: string): number {
  const len = headline.length;
  if (len < 10) return 30;
  if (len > 70) return 50;
  if (len >= 20 && len <= 60) return 90;
  return 70;
}

const COUNT = 5;

/** Default headline templates (nb) with relative strength order (strongest first). */
const TEMPLATES_NB: string[] = [
  "Lunsjordning som sparer tid og reduserer svinn",
  "Enkel lunsjbestilling for arbeidsplassen",
  "Lunchportalen – forutsigbar lunsj til kontoret",
  "Få oversikt og kontroll på firmalunsjen",
  "Lunsjlevering som fungerer – hver uke",
];

const TEMPLATES_EN: string[] = [
  "Lunch ordering that saves time and reduces waste",
  "Simple lunch ordering for the workplace",
  "Lunchportalen – predictable lunch delivered to the office",
  "Get clarity and control over corporate lunch",
  "Lunch delivery that works – every week",
];

/**
 * Returns 5 headline options ranked by conversion probability (conversionRank 1 = highest).
 * Deterministic: templates with topic/audience substitution; conversionScore from length heuristic.
 */
export function generateHeadlineVariants(input: GenerateHeadlineVariantsInput): GenerateHeadlineVariantsOutput {
  const topic = safeStr(input.topic);
  const audience = safeStr(input.audience);
  const locale = input.locale === "en" ? "en" : "nb";
  const templates = locale === "en" ? [...TEMPLATES_EN] : [...TEMPLATES_NB];

  const raw: HeadlineVariant[] = templates.slice(0, COUNT).map((t, i) => {
    let headline = t;
    if (topic) headline = headline.replace(/Lunchportalen|Lunch ordering|Lunsjordning|Lunch delivery|Lunsjlevering/i, topic.slice(0, 40));
    if (audience) headline = headline.replace(/arbeidsplassen|workplace|kontoret|office/i, audience.slice(0, 30));
    const conversionScore = conversionHeuristic(headline);
    return {
      headline,
      conversionRank: i + 1,
      conversionScore,
    };
  });

  raw.sort((a, b) => b.conversionScore - a.conversionScore);
  const headlines = raw.map((h, i) => ({
    ...h,
    conversionRank: i + 1,
  }));

  return {
    headlines,
  };
}

export { generateHeadlineVariantsCapability, CAPABILITY_NAME };
