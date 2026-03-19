/**
 * Bullet-to-paragraph conversion capability: expandBulletPoints.
 * Converts an outline (bullet points) into structured paragraphs.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "expandBulletPoints";

const expandBulletPointsCapability: Capability = {
  name: CAPABILITY_NAME,
  description: "Converts a bullet-point outline into structured paragraphs. Each bullet or outline item becomes a paragraph; order and hierarchy are preserved.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Expand bullet points input",
    required: ["outline"],
    properties: {
      outline: {
        type: "string",
        description: "Bullet-point outline (lines starting with -, *, •, or numbered)",
      },
    },
  },
  outputSchema: {
    type: "object",
    description: "Structured paragraphs",
    required: ["paragraphs", "paragraphCount"],
    properties: {
      paragraphs: {
        type: "array",
        description: "Array of paragraph strings",
        items: { type: "string" },
      },
      paragraphCount: { type: "number", description: "Number of paragraphs" },
      body: {
        type: "string",
        description: "Full body text (paragraphs joined by double newline)",
      },
    },
  },
  safetyConstraints: [
    { code: "plain_text_only", description: "Output is plain text; no HTML or markup.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(expandBulletPointsCapability);

export type ExpandBulletPointsInput = {
  /** Bullet-point outline (e.g. "- item\n- item" or "* item"). */
  outline: string;
};

export type ExpandBulletPointsOutput = {
  /** Structured paragraphs (one per bullet/item). */
  paragraphs: string[];
  paragraphCount: number;
  /** Full body: paragraphs joined by \\n\\n. */
  body: string;
};

/** Matches leading bullet (- * • ·) or numbered list (1. 1) ) on a line. */
const BULLET_PATTERN = /^\s*([-*•·]\s*|\d+[.)]\s*)/;

/**
 * Splits outline into lines and extracts bullet/item content (strip bullet prefix).
 */
function parseOutline(outline: string): string[] {
  const raw = outline
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  const items: string[] = [];
  for (const line of raw) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const withoutBullet = trimmed.replace(BULLET_PATTERN, "").trim();
    items.push(withoutBullet || trimmed);
  }
  return items;
}

/**
 * Converts a bullet-point outline into structured paragraphs.
 * Each outline item becomes one paragraph; output includes paragraphs array and a single body string.
 */
export function expandBulletPoints(input: ExpandBulletPointsInput): ExpandBulletPointsOutput {
  const outline = typeof input.outline === "string" ? input.outline : "";
  const paragraphs = parseOutline(outline);
  const body = paragraphs.join("\n\n");
  return {
    paragraphs,
    paragraphCount: paragraphs.length,
    body,
  };
}

export { expandBulletPointsCapability, CAPABILITY_NAME };
