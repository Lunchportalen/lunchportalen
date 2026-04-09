/**
 * AI whitespace optimization capability: optimizeSpacing.
 * Recommends gap, section padding, and block padding for consistent rhythm and readability.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "optimizeSpacing";

const optimizeSpacingCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Optimizes whitespace and spacing: recommends grid gap, section padding, and block padding for consistent visual rhythm and readability. Uses current values and optional section count.",
  requiredContext: ["currentSpacing"],
  inputSchema: {
    type: "object",
    description: "Spacing optimization input",
    properties: {
      currentSpacing: {
        type: "object",
        description: "Current spacing values (CSS-like)",
        properties: {
          gap: { type: "string", description: "Grid/layout gap (e.g. 0.5rem, 1rem)" },
          sectionPadding: { type: "string", description: "Padding between sections (e.g. 2rem)" },
          blockPadding: { type: "string", description: "Padding inside blocks (e.g. 1rem)" },
        },
      },
      sectionCount: { type: "number", description: "Optional: number of sections (affects recommended gap)" },
      locale: { type: "string", description: "Locale (nb | en) for recommendations" },
    },
    required: ["currentSpacing"],
  },
  outputSchema: {
    type: "object",
    description: "Optimized spacing recommendations",
    required: ["recommended", "rhythm", "recommendations", "summary"],
    properties: {
      recommended: {
        type: "object",
        required: ["gap", "sectionPadding", "blockPadding"],
        properties: {
          gap: { type: "string" },
          sectionPadding: { type: "string" },
          blockPadding: { type: "string" },
        },
      },
      rhythm: {
        type: "object",
        required: ["baseUnit", "scale"],
        properties: {
          baseUnit: { type: "string", description: "e.g. 0.25rem" },
          scale: { type: "array", items: { type: "string" }, description: "Suggested scale tokens" },
        },
      },
      recommendations: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is recommendations only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(optimizeSpacingCapability);

export type OptimizeSpacingInput = {
  currentSpacing: {
    gap?: string | null;
    sectionPadding?: string | null;
    blockPadding?: string | null;
  };
  sectionCount?: number | null;
  locale?: "nb" | "en" | null;
};

export type OptimizeSpacingOutput = {
  recommended: {
    gap: string;
    sectionPadding: string;
    blockPadding: string;
  };
  rhythm: {
    baseUnit: string;
    scale: string[];
  };
  recommendations: string[];
  summary: string;
};

const RHYTHM_BASE = "0.25rem";
const RHYTHM_SCALE = ["0.5rem", "0.75rem", "1rem", "1.25rem", "1.5rem", "2rem", "2.5rem", "3rem"];
const DEFAULT_GAP = "1.5rem";
const DEFAULT_SECTION_PADDING = "2rem";
const DEFAULT_BLOCK_PADDING = "1rem";

function parseCssLength(s: string | null | undefined): number | null {
  if (s == null || typeof s !== "string") return null;
  const t = s.trim();
  const match = t.match(/^([\d.]+)\s*(rem|em|px)$/i);
  if (!match) return null;
  const val = parseFloat(match[1]);
  if (Number.isNaN(val)) return null;
  const unit = (match[2] || "").toLowerCase();
  if (unit === "rem" || unit === "em") return val * 16;
  return val;
}

/**
 * Optimizes spacing recommendations from current values. Deterministic; no external calls.
 */
export function optimizeSpacing(input: OptimizeSpacingInput): OptimizeSpacingOutput {
  const isEn = input.locale === "en";
  const current = input.currentSpacing && typeof input.currentSpacing === "object" ? input.currentSpacing : {};
  const sectionCount = typeof input.sectionCount === "number" && !Number.isNaN(input.sectionCount) && input.sectionCount >= 0 ? input.sectionCount : null;

  const gapPx = parseCssLength(current.gap);
  const sectionPx = parseCssLength(current.sectionPadding);
  const blockPx = parseCssLength(current.blockPadding);

  let recommendedGap = DEFAULT_GAP;
  let recommendedSection = DEFAULT_SECTION_PADDING;
  let recommendedBlock = DEFAULT_BLOCK_PADDING;

  if (gapPx !== null) {
    if (gapPx < 12) recommendedGap = "1rem";
    else if (gapPx < 20) recommendedGap = "1.25rem";
    else if (gapPx <= 28) recommendedGap = "1.5rem";
    else if (gapPx <= 36) recommendedGap = "2rem";
    else recommendedGap = "2rem";
  }
  if (sectionCount !== null && sectionCount > 6) {
    recommendedGap = "1.25rem";
    recommendedSection = "1.5rem";
  }

  if (sectionPx !== null) {
    if (sectionPx < 16) recommendedSection = "1.5rem";
    else if (sectionPx <= 40) recommendedSection = "2rem";
    else recommendedSection = "2.5rem";
  }
  if (blockPx !== null) {
    if (blockPx < 12) recommendedBlock = "0.75rem";
    else if (blockPx <= 20) recommendedBlock = "1rem";
    else recommendedBlock = "1.25rem";
  }

  const recommendations: string[] = [];
  if (gapPx !== null && gapPx < 12) {
    recommendations.push(isEn ? "Grid gap is tight; use at least 1rem for breathing room." : "Grid-gap er trang; bruk minst 1rem for luft.");
  }
  if (sectionPx !== null && sectionPx < 16) {
    recommendations.push(isEn ? "Section padding is small; use 1.5rem–2rem for clear separation." : "Seksjonspadding er liten; bruk 1.5rem–2rem for tydelig separasjon.");
  }
  if (blockPx !== null && blockPx > 24) {
    recommendations.push(isEn ? "Block padding is large; consider 1rem–1.25rem for density." : "Blokkpadding er stor; vurder 1rem–1.25rem for tetthet.");
  }
  if (recommendations.length === 0) {
    recommendations.push(isEn ? "Keep a consistent rhythm: use the scale for all spacing (gap, padding, margins)." : "Hold en konsekvent rytme: bruk skalaen for all avstand (gap, padding, marginer).");
  }

  const summary = isEn
    ? `Recommended spacing: gap ${recommendedGap}, section ${recommendedSection}, block ${recommendedBlock}. Base unit ${RHYTHM_BASE}.`
    : `Anbefalt avstand: gap ${recommendedGap}, seksjon ${recommendedSection}, blokk ${recommendedBlock}. Grunnenhet ${RHYTHM_BASE}.`;

  return {
    recommended: {
      gap: recommendedGap,
      sectionPadding: recommendedSection,
      blockPadding: recommendedBlock,
    },
    rhythm: {
      baseUnit: RHYTHM_BASE,
      scale: [...RHYTHM_SCALE],
    },
    recommendations,
    summary,
  };
}

export { optimizeSpacingCapability, CAPABILITY_NAME };
