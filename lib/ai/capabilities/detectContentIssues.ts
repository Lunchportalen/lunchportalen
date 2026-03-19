/**
 * AI anomaly detection capability: detectContentIssues.
 * Detects e.g. missing sections (intro, CTA, FAQ) and low engagement from content + optional analytics.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";
import type { PagePerformanceMetrics } from "../insights/analyzePagePerformance";

const CAPABILITY_NAME = "detectContentIssues";

const detectContentIssuesCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Detects content issues and anomalies: missing sections (intro, CTA, FAQ) and low engagement. Uses page blocks and optional analytics metrics.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Detect content issues input",
    properties: {
      blocks: {
        type: "array",
        description: "Page blocks (each with type, optional heading, body, title)",
        items: { type: "object" },
      },
      metrics: {
        type: "object",
        description: "Optional pre-aggregated analytics (pageViews30d, ctaClicks30d, etc.) for engagement detection",
      },
    },
  },
  outputSchema: {
    type: "object",
    description: "Detected content issues",
    required: ["issues", "summary"],
    properties: {
      issues: {
        type: "array",
        items: {
          type: "object",
          required: ["type", "severity", "message", "suggestion"],
          properties: {
            type: { type: "string", description: "missing_sections | low_engagement" },
            severity: { type: "string", description: "low | medium | high" },
            section: { type: "string", description: "Optional: intro | cta | faq when type is missing_sections" },
            message: { type: "string" },
            suggestion: { type: "string" },
          },
        },
      },
      summary: { type: "string", description: "Short overall summary" },
    },
  },
  safetyConstraints: [
    { code: "detection_only", description: "Output is detection only; no content mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(detectContentIssuesCapability);

export type BlockLike = { type: string; heading?: string; body?: string; title?: string };

export type DetectContentIssuesInput = {
  blocks: BlockLike[];
  /** Optional analytics metrics for low-engagement detection. */
  metrics?: PagePerformanceMetrics | null;
};

export type ContentIssue = {
  type: "missing_sections" | "low_engagement";
  severity: "low" | "medium" | "high";
  /** When type is missing_sections: intro | cta | faq. */
  section?: "intro" | "cta" | "faq";
  message: string;
  suggestion: string;
};

export type DetectContentIssuesOutput = {
  issues: ContentIssue[];
  summary: string;
};

function hasIntroLikeBlock(blocks: BlockLike[]): boolean {
  if (blocks.length === 0) return false;
  const first = blocks[0];
  if (first.type === "richText") {
    const body = (first.body ?? "").trim();
    return body.length >= 30;
  }
  if (first.type === "hero") {
    const title = (first.title ?? "").trim();
    const subtitle = (first as { subtitle?: string }).subtitle ?? "";
    return (title + subtitle).trim().length >= 20;
  }
  return false;
}

function hasCtaBlock(blocks: BlockLike[]): boolean {
  return blocks.some((b) => b.type === "cta");
}

const FAQ_HEADING_REG = /faq|ofte stilte|spørsmål|vanlige spørsmål/i;

function hasFaqLikeBlock(blocks: BlockLike[]): boolean {
  return blocks.some((b) => {
    if (b.type !== "richText") return false;
    const heading = (b.heading ?? "").trim();
    const body = (b.body ?? "").trim();
    return FAQ_HEADING_REG.test(heading) || FAQ_HEADING_REG.test(body.slice(0, 200));
  });
}

function detectMissingSections(blocks: BlockLike[]): ContentIssue[] {
  const out: ContentIssue[] = [];
  if (!hasIntroLikeBlock(blocks)) {
    out.push({
      type: "missing_sections",
      severity: "medium",
      section: "intro",
      message: "Siden mangler en tydelig introduksjon øverst.",
      suggestion: "Legg til en tekstseksjon eller hero med kort introduksjon til innholdet.",
    });
  }
  if (!hasCtaBlock(blocks)) {
    out.push({
      type: "missing_sections",
      severity: "medium",
      section: "cta",
      message: "Siden mangler en oppfordring til handling (CTA).",
      suggestion: "Legg til en CTA-blokk med tydelig knapp eller lenke.",
    });
  }
  if (!hasFaqLikeBlock(blocks)) {
    out.push({
      type: "missing_sections",
      severity: "low",
      section: "faq",
      message: "Siden har ikke en FAQ-seksjon.",
      suggestion: "Vurder å legge til ofte stilte spørsmål for bedre konvertering og SEO.",
    });
  }
  return out;
}

const MIN_VIEWS_FOR_ENGAGEMENT = 20;
const LOW_CTR_THRESHOLD_PCT = 2;

function detectLowEngagement(metrics: PagePerformanceMetrics): ContentIssue[] {
  const out: ContentIssue[] = [];
  const views30 = metrics.pageViews30d ?? 0;
  const cta30 = metrics.ctaClicks30d ?? 0;

  if (views30 > 0 && views30 < MIN_VIEWS_FOR_ENGAGEMENT) {
    out.push({
      type: "low_engagement",
      severity: "medium",
      message: `Lav trafikk: ${views30} visninger siste 30 dager.`,
      suggestion: "Vurder mer synlighet (lenker, søk, kampanjer) eller sjekk at analytics er aktiv.",
    });
  }

  if (views30 >= MIN_VIEWS_FOR_ENGAGEMENT && cta30 >= 0) {
    const ctrPct = views30 > 0 ? (cta30 / views30) * 100 : 0;
    if (ctrPct < LOW_CTR_THRESHOLD_PCT) {
      out.push({
        type: "low_engagement",
        severity: "high",
        message: `Lav CTA-engagement: ${cta30} klikk på ${views30} visninger (${ctrPct.toFixed(1)} % CTR).`,
        suggestion: "Plasser CTA høyere eller gjør den tydeligere; test ulike tekster eller uttrykk.",
      });
    }
  }

  if (views30 === 0 && (metrics.ctaClicks30d ?? 0) === 0 && (metrics.searchCount30d ?? 0) === 0) {
    out.push({
      type: "low_engagement",
      severity: "low",
      message: "Ingen engasjementsdata tilgjengelig for denne siden.",
      suggestion: "Sjekk at sidevisninger og CTA-klikk sendes til analytics.",
    });
  }

  return out;
}

/**
 * Detects content issues: missing sections (intro, CTA, FAQ) and, when metrics are provided, low engagement.
 * Deterministic; no external calls.
 */
export function detectContentIssues(input: DetectContentIssuesInput): DetectContentIssuesOutput {
  const blocks = Array.isArray(input.blocks) ? input.blocks : [];
  const metrics = input.metrics ?? undefined;

  const issues: ContentIssue[] = [];

  issues.push(...detectMissingSections(blocks));

  if (metrics) {
    issues.push(...detectLowEngagement(metrics));
  }

  const missingCount = issues.filter((i) => i.type === "missing_sections").length;
  const engagementCount = issues.filter((i) => i.type === "low_engagement").length;
  let summary: string;
  if (issues.length === 0) {
    summary = "Ingen innholdsavvik funnet. Vurder å kjøre med analytics for engasjementssjekk.";
  } else if (missingCount > 0 && engagementCount > 0) {
    summary = `${missingCount} manglende seksjon(er) og ${engagementCount} engasjementsanmerkning(er).`;
  } else if (missingCount > 0) {
    summary = `${missingCount} manglende seksjon(er) oppdaget.`;
  } else {
    summary = `${engagementCount} engasjementsanmerkning(er) basert på analytics.`;
  }

  return {
    issues,
    summary,
  };
}

export { detectContentIssuesCapability, CAPABILITY_NAME };
