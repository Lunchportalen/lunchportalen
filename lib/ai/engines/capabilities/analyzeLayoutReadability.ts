/**
 * AI layout readability analyzer capability: analyzeLayoutReadability.
 * Analyzes layout structure for readability and scannability: section count, density, visual hierarchy,
 * gap, and column complexity. Returns score, metrics, issues, and suggestions. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "analyzeLayoutReadability";

const analyzeLayoutReadabilityCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Analyzes layout readability and scannability: section count, density, visual hierarchy (hero, CTA), gap and spacing, column complexity. Returns a 0–100 score, metrics, issues, and suggestions.",
  requiredContext: ["layout"],
  inputSchema: {
    type: "object",
    description: "Layout readability input",
    properties: {
      layout: {
        type: "object",
        description: "Layout to analyze",
        properties: {
          sections: {
            type: "array",
            description: "Sections (id, type). Types: hero, features, cta, faq, richText, etc.",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: { type: "string" },
              },
            },
          },
          placements: {
            type: "array",
            description: "Optional: placements with columnSpan per section",
            items: {
              type: "object",
              properties: {
                sectionId: { type: "string" },
                columnSpan: { type: "number" },
                rowIndex: { type: "number" },
              },
            },
          },
          columns: { type: "number", description: "Grid columns (e.g. 12)" },
          gap: { type: "string", description: "CSS gap (e.g. 1.5rem)" },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["layout"],
  },
  outputSchema: {
    type: "object",
    description: "Layout readability result",
    required: ["score", "metrics", "issues", "suggestions", "summary"],
    properties: {
      score: { type: "number", description: "Readability score 0–100 (higher = more scannable)" },
      metrics: {
        type: "object",
        required: ["sectionCount", "hasHero", "hasCta", "density", "maxColumnsPerRow", "gapScore"],
        properties: {
          sectionCount: { type: "number" },
          hasHero: { type: "boolean" },
          hasCta: { type: "boolean" },
          density: { type: "string", description: "low | medium | high" },
          maxColumnsPerRow: { type: "number" },
          gapScore: { type: "number", description: "0–1 adequacy of gap" },
        },
      },
      issues: { type: "array", items: { type: "string" } },
      suggestions: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is analysis only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(analyzeLayoutReadabilityCapability);

export type LayoutReadabilityInput = {
  layout: {
    sections?: Array<{ id?: string | null; type?: string | null }> | null;
    placements?: Array<{ sectionId?: string | null; columnSpan?: number | null; rowIndex?: number | null }> | null;
    columns?: number | null;
    gap?: string | null;
  };
  locale?: "nb" | "en" | null;
};

export type LayoutReadabilityMetrics = {
  sectionCount: number;
  hasHero: boolean;
  hasCta: boolean;
  density: "low" | "medium" | "high";
  maxColumnsPerRow: number;
  gapScore: number;
};

export type AnalyzeLayoutReadabilityOutput = {
  score: number;
  metrics: LayoutReadabilityMetrics;
  issues: string[];
  suggestions: string[];
  summary: string;
};

function parseGap(gap: string | null | undefined): number {
  if (gap == null || typeof gap !== "string") return 0;
  const s = gap.trim();
  const match = s.match(/^([\d.]+)\s*(rem|px|em)$/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = (match[2] || "").toLowerCase();
  if (unit === "rem" || unit === "em") return val * 16;
  return val;
}

/**
 * Analyzes layout for readability and scannability. Deterministic; no external calls.
 */
export function analyzeLayoutReadability(input: LayoutReadabilityInput): AnalyzeLayoutReadabilityOutput {
  const isEn = input.locale === "en";
  const layout = input.layout && typeof input.layout === "object" ? input.layout : {};
  const sections = Array.isArray(layout.sections) ? layout.sections : [];
  const placements = Array.isArray(layout.placements) ? layout.placements : [];
  const columns = typeof layout.columns === "number" && !Number.isNaN(layout.columns) && layout.columns > 0 ? layout.columns : 12;
  const gapPx = parseGap(layout.gap);

  const sectionCount = sections.length;
  const types = new Set(sections.map((s) => String(s?.type ?? "").trim().toLowerCase()));
  const hasHero = types.has("hero");
  const hasCta = types.has("cta");

  let maxColumnsPerRow = 0;
  if (placements.length > 0) {
    const rowSpans = new Map<number, number>();
    for (const p of placements) {
      const row = typeof p.rowIndex === "number" ? p.rowIndex : 0;
      const span = typeof p.columnSpan === "number" && p.columnSpan > 0 ? p.columnSpan : columns;
      rowSpans.set(row, (rowSpans.get(row) ?? 0) + span);
    }
    maxColumnsPerRow = rowSpans.size > 0 ? Math.max(...rowSpans.values()) : columns;
  } else {
    maxColumnsPerRow = sectionCount > 0 ? columns : 0;
  }

  const density: "low" | "medium" | "high" =
    sectionCount <= 3 ? "low" : sectionCount <= 6 ? "medium" : "high";

  const gapScore =
    gapPx >= 20 ? 1 : gapPx >= 12 ? 0.7 : gapPx >= 8 ? 0.5 : gapPx > 0 ? 0.3 : 0;

  const issues: string[] = [];
  const suggestions: string[] = [];

  if (!hasHero && sectionCount > 0) {
    issues.push(isEn ? "No hero section; above-the-fold focus may be weak." : "Mangler hero-seksjon; fokus over fold kan være svakt.");
    suggestions.push(isEn ? "Add a hero with one headline and primary CTA." : "Legg til en hero med én overskrift og hoved-CTA.");
  }
  if (!hasCta && sectionCount > 0) {
    issues.push(isEn ? "No CTA section; conversion path may be unclear." : "Mangler CTA-seksjon; konverteringsvei kan være uklar.");
    suggestions.push(isEn ? "Add a clear CTA block before the end." : "Legg til en tydelig CTA-blokk før slutten.");
  }
  if (sectionCount > 8) {
    issues.push(isEn ? "Many sections; consider grouping to reduce cognitive load." : "Mange seksjoner; vurder gruppering for å redusere kognitiv belastning.");
    suggestions.push(isEn ? "Aim for 5–7 main sections; nest secondary content." : "Sikte på 5–7 hovedseksjoner; plasser sekundært innhold under.");
  }
  if (maxColumnsPerRow > 6 && columns >= 12) {
    issues.push(isEn ? "Wide row (many columns); may hurt scannability on desktop." : "Bred rad (mange kolonner); kan svekke skannbarhet på desktop.");
    suggestions.push(isEn ? "Prefer 1–3 columns per row for main content." : "Foretrekk 1–3 kolonner per rad for hovedinnhold.");
  }
  if (gapScore < 0.5) {
    issues.push(isEn ? "Small or missing gap between sections." : "Liten eller manglende avstand mellom seksjoner.");
    suggestions.push(isEn ? "Use at least 1rem (16px) gap between sections." : "Bruk minst 1rem (16px) avstand mellom seksjoner.");
  }
  if (sectionCount === 0) {
    issues.push(isEn ? "No sections; layout is empty." : "Ingen seksjoner; layout er tom.");
  }

  let score = 60;
  if (hasHero) score += 10;
  if (hasCta) score += 10;
  score += gapScore * 10;
  if (density === "low") score += 5;
  if (density === "medium") score += 0;
  if (density === "high") score -= 5;
  if (sectionCount > 8) score -= 10;
  if (maxColumnsPerRow > 6 && columns >= 12) score -= 5;
  score = Math.max(0, Math.min(100, Math.round(score)));

  if (issues.length === 0 && sectionCount > 0) {
    suggestions.push(isEn ? "Layout has clear structure; keep gap and hierarchy consistent on mobile." : "Layout har tydelig struktur; behold avstand og hierarki på mobil.");
  }

  const summary = isEn
    ? `Layout readability: ${score}/100. ${sectionCount} section(s), ${density} density. ${issues.length} issue(s).`
    : `Layout lesbarhet: ${score}/100. ${sectionCount} seksjon(er), ${density} tetthet. ${issues.length} problem(er).`;

  return {
    score,
    metrics: {
      sectionCount,
      hasHero,
      hasCta,
      density,
      maxColumnsPerRow,
      gapScore: Math.round(gapScore * 100) / 100,
    },
    issues,
    suggestions,
    summary,
  };
}

export { analyzeLayoutReadabilityCapability, CAPABILITY_NAME };
