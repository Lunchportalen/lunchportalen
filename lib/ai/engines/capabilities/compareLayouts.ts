/**
 * Layout similarity detector capability: compareLayouts.
 * Compares two layouts (block type sequences) and returns similarity score,
 * position-wise differences, and summary. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "compareLayouts";

const compareLayoutsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Compares two layouts and returns similarity score (0-1), position-wise differences, and summary. Input: two layouts as block type sequences (blocks array or blockTypes array). Deterministic; no LLM.",
  requiredContext: ["layoutA", "layoutB"],
  inputSchema: {
    type: "object",
    description: "Compare layouts input",
    properties: {
      layoutA: {
        type: "object",
        description: "First layout: blocks (id, type) or blockTypes (string array)",
        properties: {
          blocks: {
            type: "array",
            items: { type: "object", properties: { id: { type: "string" }, type: { type: "string" } } },
          },
          blockTypes: { type: "array", items: { type: "string" } },
        },
      },
      layoutB: {
        type: "object",
        description: "Second layout: same shape as layoutA",
        properties: {
          blocks: {
            type: "array",
            items: { type: "object", properties: { id: { type: "string" }, type: { type: "string" } } },
          },
          blockTypes: { type: "array", items: { type: "string" } },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["layoutA", "layoutB"],
  },
  outputSchema: {
    type: "object",
    description: "Layout comparison result",
    required: ["similarityScore", "differences", "summary"],
    properties: {
      similarityScore: { type: "number", description: "0-1 (1 = identical type sequence)" },
      sameLength: { type: "boolean" },
      matchCount: { type: "number", description: "Number of positions with matching type" },
      lengthA: { type: "number" },
      lengthB: { type: "number" },
      differences: {
        type: "array",
        items: {
          type: "object",
          required: ["index", "typeA", "typeB", "match"],
          properties: {
            index: { type: "number" },
            typeA: { type: "string" },
            typeB: { type: "string" },
            match: { type: "boolean" },
          },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is comparison only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(compareLayoutsCapability);

export type CompareLayoutsLayoutInput = {
  blocks?: Array<{ id?: string | null; type?: string | null }> | null;
  blockTypes?: string[] | null;
};

export type CompareLayoutsInput = {
  layoutA: CompareLayoutsLayoutInput;
  layoutB: CompareLayoutsLayoutInput;
  locale?: "nb" | "en" | null;
};

export type LayoutDifference = {
  index: number;
  typeA: string;
  typeB: string;
  match: boolean;
};

export type CompareLayoutsOutput = {
  similarityScore: number;
  sameLength: boolean;
  matchCount: number;
  lengthA: number;
  lengthB: number;
  differences: LayoutDifference[];
  summary: string;
};

function toTypeSequence(layout: CompareLayoutsLayoutInput): string[] {
  if (Array.isArray(layout.blockTypes) && layout.blockTypes.length > 0) {
    return layout.blockTypes.map((t) => (typeof t === "string" ? t : "").trim().toLowerCase()).filter(Boolean);
  }
  if (Array.isArray(layout.blocks) && layout.blocks.length > 0) {
    return layout.blocks
      .map((b) => (b && typeof b === "object" && "type" in b ? String((b as { type?: unknown }).type ?? "").trim().toLowerCase() : ""))
      .filter(Boolean);
  }
  return [];
}

/**
 * Compares two layouts; returns similarity score and position-wise differences. Deterministic; no external calls.
 */
export function compareLayouts(input: CompareLayoutsInput): CompareLayoutsOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const layoutA = input.layoutA && typeof input.layoutA === "object" ? input.layoutA : {};
  const layoutB = input.layoutB && typeof input.layoutB === "object" ? input.layoutB : {};

  const typesA = toTypeSequence(layoutA);
  const typesB = toTypeSequence(layoutB);
  const lengthA = typesA.length;
  const lengthB = typesB.length;
  const maxLen = Math.max(lengthA, lengthB, 1);

  const differences: LayoutDifference[] = [];
  let matchCount = 0;
  for (let i = 0; i < maxLen; i++) {
    const typeA = i < lengthA ? typesA[i] : "";
    const typeB = i < lengthB ? typesB[i] : "";
    const match = typeA === typeB && typeA !== "";
    if (match) matchCount += 1;
    differences.push({
      index: i,
      typeA: typeA || (isEn ? "(none)" : "(ingen)"),
      typeB: typeB || (isEn ? "(none)" : "(ingen)"),
      match,
    });
  }

  const sameLength = lengthA === lengthB;
  const similarityScore = maxLen === 0 ? 1 : Math.round((matchCount / maxLen) * 100) / 100;

  const summary = isEn
    ? `Similarity: ${(similarityScore * 100).toFixed(0)}%. ${matchCount}/${maxLen} positions match. ${sameLength ? "Same length." : `Lengths: ${lengthA} vs ${lengthB}.`}`
    : `Likhet: ${(similarityScore * 100).toFixed(0)}%. ${matchCount}/${maxLen} posisjoner matcher. ${sameLength ? "Samme lengde." : `Lengder: ${lengthA} vs ${lengthB}.`}`;

  return {
    similarityScore,
    sameLength,
    matchCount,
    lengthA,
    lengthB,
    differences,
    summary,
  };
}

export { compareLayoutsCapability, CAPABILITY_NAME };
