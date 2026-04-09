/**
 * AI cognitive load analyzer capability: analyzePageComplexity.
 * Analyzes page structure and content for cognitive load: visual density, choice overload, content volume, structure clarity.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "analyzePageComplexity";

const analyzePageComplexityCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Analyzes page complexity and cognitive load. Evaluates visual density, choice overload (links/CTAs/options), content volume, and structure clarity. Returns a complexity score (lower = simpler), load level, dimensions, and suggestions to reduce load.",
  requiredContext: ["page"],
  inputSchema: {
    type: "object",
    description: "Analyze page complexity input",
    properties: {
      page: {
        type: "object",
        description: "Page structure and content signals",
        properties: {
          blockCount: { type: "number", description: "Number of blocks/sections" },
          wordCount: { type: "number", description: "Total word count" },
          linkCount: { type: "number", description: "Number of links (in-content + nav)" },
          ctaCount: { type: "number", description: "Number of CTA buttons or primary actions" },
          headingCount: { type: "number", description: "Number of headings (H2, H3, etc.)" },
          imageCount: { type: "number", description: "Number of images" },
          formFieldCount: { type: "number", description: "Number of form fields if applicable" },
          blocks: {
            type: "array",
            description: "Optional block list to derive counts",
            items: { type: "object" },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for suggestions" },
    },
    required: ["page"],
  },
  outputSchema: {
    type: "object",
    description: "Page complexity analysis",
    required: ["complexityScore", "cognitiveLoadLevel", "dimensions", "factors", "suggestions", "summary"],
    properties: {
      complexityScore: { type: "number", description: "0-100, lower = simpler page (less cognitive load)" },
      cognitiveLoadLevel: { type: "string", description: "low | medium | high" },
      dimensions: {
        type: "object",
        required: ["visualDensity", "choiceOverload", "contentVolume", "structureClarity"],
        properties: {
          visualDensity: { type: "object", properties: { score: { type: "number" }, label: { type: "string" } } },
          choiceOverload: { type: "object", properties: { score: { type: "number" }, label: { type: "string" } } },
          contentVolume: { type: "object", properties: { score: { type: "number" }, label: { type: "string" } } },
          structureClarity: { type: "object", properties: { score: { type: "number" }, label: { type: "string" } } },
        },
      },
      factors: {
        type: "array",
        items: { type: "object", properties: { name: { type: "string" }, impact: { type: "string" }, value: { type: "number" } } },
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

registerCapability(analyzePageComplexityCapability);

export type PageComplexityInput = {
  blockCount?: number | null;
  wordCount?: number | null;
  linkCount?: number | null;
  ctaCount?: number | null;
  headingCount?: number | null;
  imageCount?: number | null;
  formFieldCount?: number | null;
  blocks?: Array<{ type?: string | null; heading?: string | null }> | null;
};

export type AnalyzePageComplexityInput = {
  page: PageComplexityInput;
  locale?: "nb" | "en" | null;
};

export type ComplexityDimension = {
  score: number;
  label: string;
};

export type ComplexityFactor = {
  name: string;
  impact: "increases" | "decreases" | "neutral";
  value: number;
};

export type AnalyzePageComplexityOutput = {
  complexityScore: number;
  cognitiveLoadLevel: "low" | "medium" | "high";
  dimensions: {
    visualDensity: ComplexityDimension;
    choiceOverload: ComplexityDimension;
    contentVolume: ComplexityDimension;
    structureClarity: ComplexityDimension;
  };
  factors: ComplexityFactor[];
  suggestions: string[];
  summary: string;
};

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function deriveCounts(page: PageComplexityInput): {
  blockCount: number;
  wordCount: number;
  linkCount: number;
  ctaCount: number;
  headingCount: number;
  imageCount: number;
  formFieldCount: number;
} {
  const blocks = Array.isArray(page.blocks) ? page.blocks : [];
  const blockCount = Math.max(0, Math.floor(Number(page.blockCount) ?? 0)) || blocks.length;
  const wordCount = Math.max(0, Math.floor(Number(page.wordCount) ?? 0));
  const linkCount = Math.max(0, Math.floor(Number(page.linkCount) ?? 0));
  let ctaCount = Math.max(0, Math.floor(Number(page.ctaCount) ?? 0));
  let headingCount = Math.max(0, Math.floor(Number(page.headingCount) ?? 0));
  let imageCount = Math.max(0, Math.floor(Number(page.imageCount) ?? 0));
  const formFieldCount = Math.max(0, Math.floor(Number(page.formFieldCount) ?? 0));

  for (const b of blocks) {
    const t = (b?.type ?? "").toString().toLowerCase();
    if (t === "cta" || t === "button") ctaCount = Math.max(ctaCount, 1);
    if (t === "image" || t === "hero") imageCount++;
    if ((b?.heading ?? "").toString().trim()) headingCount++;
  }

  return {
    blockCount,
    wordCount: wordCount || 0,
    linkCount,
    ctaCount,
    headingCount,
    imageCount,
    formFieldCount,
  };
}

/**
 * Analyzes page complexity and cognitive load from structure and content signals.
 * Lower complexityScore = simpler page = lower cognitive load.
 * Deterministic; no external calls.
 */
export function analyzePageComplexity(input: AnalyzePageComplexityInput): AnalyzePageComplexityOutput {
  const isEn = input.locale === "en";
  const page = input.page ?? {};
  const c = deriveCounts(page);
  const factors: ComplexityFactor[] = [];

  // Visual density: blocks + images per "screen" (rough). Higher blocks/images = higher density = higher complexity.
  const densityRaw = Math.min(100, c.blockCount * 4 + c.imageCount * 3);
  const visualDensity: ComplexityDimension = {
    score: clamp(densityRaw),
    label: densityRaw <= 30 ? (isEn ? "Low" : "Lav") : densityRaw <= 60 ? (isEn ? "Medium" : "Middels") : (isEn ? "High" : "Høy"),
  };
  if (c.blockCount > 8) factors.push({ name: isEn ? "Many blocks" : "Mange blokker", impact: "increases", value: c.blockCount });
  if (c.imageCount > 4) factors.push({ name: isEn ? "Many images" : "Mange bilder", impact: "increases", value: c.imageCount });

  // Choice overload: links + CTAs + form fields. More choices = higher load.
  const choices = c.linkCount + c.ctaCount * 2 + c.formFieldCount * 2;
  const choiceRaw = Math.min(100, choices * 2);
  const choiceOverload: ComplexityDimension = {
    score: clamp(choiceRaw),
    label: choiceRaw <= 25 ? (isEn ? "Low" : "Lav") : choiceRaw <= 55 ? (isEn ? "Medium" : "Middels") : (isEn ? "High" : "Høy"),
  };
  if (c.linkCount > 10) factors.push({ name: isEn ? "Many links" : "Mange lenker", impact: "increases", value: c.linkCount });
  if (c.ctaCount > 2) factors.push({ name: isEn ? "Multiple CTAs" : "Flere CTA-er", impact: "increases", value: c.ctaCount });
  if (c.formFieldCount > 5) factors.push({ name: isEn ? "Long form" : "Lang skjema", impact: "increases", value: c.formFieldCount });

  // Content volume: word count. Very long = higher load.
  const volumeRaw = c.wordCount <= 300 ? 15 : c.wordCount <= 800 ? 35 : c.wordCount <= 1500 ? 55 : Math.min(100, 55 + (c.wordCount - 1500) / 50);
  const contentVolume: ComplexityDimension = {
    score: clamp(volumeRaw),
    label: volumeRaw <= 30 ? (isEn ? "Low" : "Lav") : volumeRaw <= 60 ? (isEn ? "Medium" : "Middels") : (isEn ? "High" : "Høy"),
  };
  if (c.wordCount > 1200) factors.push({ name: isEn ? "Long content" : "Langt innhold", impact: "increases", value: c.wordCount });

  // Structure clarity: headings help. Good heading-to-block ratio = lower complexity.
  const headingRatio = c.blockCount > 0 ? c.headingCount / c.blockCount : 0;
  const structureRaw = headingRatio >= 0.8 ? 20 : headingRatio >= 0.4 ? 45 : 70;
  const structureClarity: ComplexityDimension = {
    score: clamp(structureRaw),
    label: structureRaw <= 30 ? (isEn ? "Clear" : "Tydelig") : structureRaw <= 55 ? (isEn ? "Moderate" : "Moderat") : (isEn ? "Unclear" : "Utydelig"),
  };
  if (c.headingCount >= 2 && headingRatio < 0.5) factors.push({ name: isEn ? "Few headings" : "Få overskrifter", impact: "increases", value: c.headingCount });

  const complexityScore = clamp(
    (visualDensity.score + choiceOverload.score + contentVolume.score + structureClarity.score) / 4
  );
  const cognitiveLoadLevel: "low" | "medium" | "high" =
    complexityScore <= 35 ? "low" : complexityScore <= 60 ? "medium" : "high";

  const suggestions: string[] = [];
  if (visualDensity.score > 55) {
    suggestions.push(
      isEn
        ? "Reduce visual density: fewer blocks per view or collapse secondary content."
        : "Reduser visuell tetthet: færre blokker per visning eller samle sekundært innhold."
    );
  }
  if (choiceOverload.score > 55) {
    suggestions.push(
      isEn
        ? "Reduce choices: one primary CTA, fewer in-content links, or break long forms into steps."
        : "Reduser valg: én primær CTA, færre lenker i innholdet, eller del lange skjemaer i steg."
    );
  }
  if (contentVolume.score > 60) {
    suggestions.push(
      isEn
        ? "Reduce content volume: shorten copy, move detail to subpages, or add progressive disclosure."
        : "Reduser innholdsmengde: forkort teksten, flytt detaljer til undersider, eller bruk progresiv avsløring."
    );
  }
  if (structureClarity.score > 55) {
    suggestions.push(
      isEn
        ? "Improve structure: add headings, group related blocks, or use a clear one-column flow."
        : "Forbedre struktur: legg til overskrifter, grupper relaterte blokker, eller bruk tydelig én-kolonne-flyt."
    );
  }
  if (suggestions.length === 0) {
    suggestions.push(
      isEn ? "Cognitive load is within a manageable range." : "Kognitiv belastning er innenfor et håndterbart område."
    );
  }

  const summary = isEn
    ? `Complexity ${complexityScore}/100 (${cognitiveLoadLevel} cognitive load). Dimensions: visual ${visualDensity.label}, choices ${choiceOverload.label}, volume ${contentVolume.label}, structure ${structureClarity.label}.`
    : `Kompleksitet ${complexityScore}/100 (${cognitiveLoadLevel} kognitiv belastning). Dimensjoner: visuell ${visualDensity.label}, valg ${choiceOverload.label}, volum ${contentVolume.label}, struktur ${structureClarity.label}.`;

  return {
    complexityScore,
    cognitiveLoadLevel,
    dimensions: {
      visualDensity,
      choiceOverload,
      contentVolume,
      structureClarity,
    },
    factors,
    suggestions,
    summary,
  };
}

export { analyzePageComplexityCapability, CAPABILITY_NAME };
