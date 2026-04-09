/**
 * AI content authority scorer capability: scoreContentAuthority.
 * Scores content on expertise, depth, citations, and uniqueness (each 0–100).
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "scoreContentAuthority";

const scoreContentAuthorityCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Scores content authority on four dimensions: expertise (signals of subject-matter depth), depth (length and structure), citations (sources and references), and uniqueness (differentiation from generic content). Each dimension 0–100.",
  requiredContext: ["content"],
  inputSchema: {
    type: "object",
    description: "Score content authority input",
    properties: {
      content: {
        type: "object",
        description: "Content to score",
        properties: {
          wordCount: { type: "number", description: "Total word count" },
          blocks: {
            type: "array",
            description: "Content blocks (type, heading, body) for structure signals",
            items: { type: "object" },
          },
          citationCount: { type: "number", description: "Number of citations or source links" },
          externalLinkCount: { type: "number", description: "Number of external/source links" },
          hasFaq: { type: "boolean", description: "Has FAQ or Q&A structure" },
          hasHowTo: { type: "boolean", description: "Has how-to or step structure" },
          hasDefinitions: { type: "boolean", description: "Has definitions or glossary-like content" },
          uniquePhraseRatio: {
            type: "number",
            description: "Optional 0-1 ratio of unique phrases vs generic (for uniqueness)",
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for summary" },
    },
    required: ["content"],
  },
  outputSchema: {
    type: "object",
    description: "Content authority scores",
    required: ["expertise", "depth", "citations", "uniqueness", "overall", "summary"],
    properties: {
      expertise: {
        type: "object",
        required: ["score", "signals"],
        properties: {
          score: { type: "number", description: "0-100" },
          signals: { type: "array", items: { type: "string" }, description: "What drove the score" },
        },
      },
      depth: {
        type: "object",
        required: ["score", "signals"],
        properties: {
          score: { type: "number", description: "0-100" },
          signals: { type: "array", items: { type: "string" } },
        },
      },
      citations: {
        type: "object",
        required: ["score", "signals"],
        properties: {
          score: { type: "number", description: "0-100" },
          signals: { type: "array", items: { type: "string" } },
        },
      },
      uniqueness: {
        type: "object",
        required: ["score", "signals"],
        properties: {
          score: { type: "number", description: "0-100" },
          signals: { type: "array", items: { type: "string" } },
        },
      },
      overall: { type: "number", description: "Average of four dimensions 0-100" },
      summary: { type: "string", description: "Short summary" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is scores only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(scoreContentAuthorityCapability);

export type ContentAuthorityInput = {
  wordCount?: number | null;
  blocks?: Array<{ type?: string | null; heading?: string | null; body?: string | null }> | null;
  citationCount?: number | null;
  externalLinkCount?: number | null;
  hasFaq?: boolean | null;
  hasHowTo?: boolean | null;
  hasDefinitions?: boolean | null;
  /** 0-1 ratio for uniqueness when compared to reference content. */
  uniquePhraseRatio?: number | null;
};

export type ScoreContentAuthorityInput = {
  content: ContentAuthorityInput;
  locale?: "nb" | "en" | null;
};

export type DimensionScore = {
  score: number;
  signals: string[];
};

export type ScoreContentAuthorityOutput = {
  expertise: DimensionScore;
  depth: DimensionScore;
  citations: DimensionScore;
  uniqueness: DimensionScore;
  overall: number;
  summary: string;
};

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function countWordsInBlocks(blocks: ContentAuthorityInput["blocks"]): number {
  if (!Array.isArray(blocks)) return 0;
  let n = 0;
  for (const b of blocks) {
    const body = (b?.body ?? "").trim();
    const heading = (b?.heading ?? "").trim();
    n += body.split(/\s+/).filter(Boolean).length + heading.split(/\s+/).filter(Boolean).length;
  }
  return n;
}

function blockCount(blocks: ContentAuthorityInput["blocks"]): number {
  return Array.isArray(blocks) ? blocks.length : 0;
}

function hasBlockType(blocks: ContentAuthorityInput["blocks"], type: string): boolean {
  if (!Array.isArray(blocks)) return false;
  return blocks.some((b) => (b?.type ?? "").toLowerCase() === type.toLowerCase());
}

/**
 * Scores content authority on expertise, depth, citations, and uniqueness.
 * Deterministic heuristics; no external calls.
 */
export function scoreContentAuthority(input: ScoreContentAuthorityInput): ScoreContentAuthorityOutput {
  const isEn = input.locale === "en";
  const c = input.content ?? {};
  const blocks = c.blocks;
  const wordCount = typeof c.wordCount === "number" && !Number.isNaN(c.wordCount)
    ? Math.max(0, c.wordCount)
    : countWordsInBlocks(blocks);
  const citationCount = Math.max(0, Math.floor(Number(c.citationCount) ?? 0));
  const externalLinkCount = Math.max(0, Math.floor(Number(c.externalLinkCount) ?? 0));
  const totalRefs = citationCount + externalLinkCount;
  const hasFaq = c.hasFaq === true || hasBlockType(blocks, "faq") || hasBlockType(blocks, "accordion");
  const hasHowTo = c.hasHowTo === true || hasBlockType(blocks, "howTo") || hasBlockType(blocks, "steps");
  const hasDefinitions = c.hasDefinitions === true || hasBlockType(blocks, "definition") || hasBlockType(blocks, "glossary");
  const uniqueRatio = typeof c.uniquePhraseRatio === "number" && !Number.isNaN(c.uniquePhraseRatio)
    ? Math.max(0, Math.min(1, c.uniquePhraseRatio))
    : null;

  const blockCnt = blockCount(blocks);

  // Expertise: FAQ, how-to, definitions, sufficient length
  const expertiseSignals: string[] = [];
  let expertiseRaw = 40;
  if (wordCount >= 300) {
    expertiseRaw += 15;
    expertiseSignals.push(isEn ? "Sufficient length" : "Tilstrekkelig lengde");
  }
  if (hasFaq) {
    expertiseRaw += 15;
    expertiseSignals.push(isEn ? "FAQ structure" : "FAQ-struktur");
  }
  if (hasHowTo) {
    expertiseRaw += 15;
    expertiseSignals.push(isEn ? "How-to / steps" : "Slik gjør du / steg");
  }
  if (hasDefinitions) {
    expertiseRaw += 15;
    expertiseSignals.push(isEn ? "Definitions" : "Definisjoner");
  }
  if (blockCnt >= 4) {
    expertiseRaw += 10;
    expertiseSignals.push(isEn ? "Structured sections" : "Strukturerte seksjoner");
  }
  const expertise: DimensionScore = {
    score: clamp(expertiseRaw),
    signals: expertiseSignals.length ? expertiseSignals : [isEn ? "Basic content" : "Grunnleggende innhold"],
  };

  // Depth: word count and block count
  const depthSignals: string[] = [];
  let depthRaw = Math.min(100, 20 + Math.floor(wordCount / 50));
  if (wordCount >= 800) depthRaw = Math.min(100, depthRaw + 15);
  if (wordCount >= 1500) depthRaw = Math.min(100, depthRaw + 10);
  if (blockCnt >= 5) {
    depthRaw = Math.min(100, depthRaw + 10);
    depthSignals.push(isEn ? "Multiple sections" : "Flere seksjoner");
  }
  depthRaw = Math.min(100, depthRaw);
  if (wordCount >= 500) depthSignals.push(`${wordCount} ${isEn ? "words" : "ord"}`);
  const depth: DimensionScore = {
    score: clamp(depthRaw),
    signals: depthSignals.length ? depthSignals : [isEn ? "Short content" : "Kort innhold"],
  };

  // Citations: refs and links
  const citationSignals: string[] = [];
  let citationRaw = totalRefs >= 3 ? 80 : totalRefs >= 1 ? 50 : 20;
  if (totalRefs >= 5) citationRaw = 95;
  if (citationCount > 0) citationSignals.push(isEn ? "Cited sources" : "Sitater/kilder");
  if (externalLinkCount > 0) citationSignals.push(isEn ? "External links" : "Eksterne lenker");
  if (totalRefs === 0) citationSignals.push(isEn ? "No citations" : "Ingen sitater");
  const citations: DimensionScore = {
    score: clamp(citationRaw),
    signals: citationSignals.length ? citationSignals : [isEn ? "No references" : "Ingen referanser"],
  };

  // Uniqueness: ratio if provided; else neutral
  const uniquenessSignals: string[] = [];
  let uniquenessRaw = 50;
  if (uniqueRatio !== null) {
    uniquenessRaw = Math.round(uniqueRatio * 100);
    uniquenessSignals.push(isEn ? "Compared to reference" : "Sammenlignet med referanse");
  } else {
    uniquenessSignals.push(isEn ? "Not compared" : "Ikke sammenlignet");
  }
  const uniqueness: DimensionScore = {
    score: clamp(uniquenessRaw),
    signals: uniquenessSignals,
  };

  const overall = Math.round(
    (expertise.score + depth.score + citations.score + uniqueness.score) / 4
  );

  const summary = isEn
    ? `Authority: expertise ${expertise.score}, depth ${depth.score}, citations ${citations.score}, uniqueness ${uniqueness.score}. Overall ${overall}/100.`
    : `Autoritet: ekspertise ${expertise.score}, dybde ${depth.score}, sitater ${citations.score}, unikhet ${uniqueness.score}. Samlet ${overall}/100.`;

  return {
    expertise,
    depth,
    citations,
    uniqueness,
    overall: clamp(overall),
    summary,
  };
}

export { scoreContentAuthorityCapability, CAPABILITY_NAME };
