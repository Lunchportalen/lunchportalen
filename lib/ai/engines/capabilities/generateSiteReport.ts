/**
 * AI site intelligence report capability: generateSiteReport.
 * Produces a structured site report from aggregated page, analytics, and health signals.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "generateSiteReport";

const generateSiteReportCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates a site intelligence report: summary, metrics, content health signals, and top recommendations. Uses aggregated page list, analytics summary, and optional issue counts.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Generate site report input",
    properties: {
      siteName: { type: "string", description: "Optional site or product name" },
      pageCount: { type: "number", description: "Total number of content pages" },
      pagesWithIssues: { type: "number", description: "Optional count of pages with detected content issues" },
      totalPageViews30d: { type: "number", description: "Optional aggregate page views (30d)" },
      totalCtaClicks30d: { type: "number", description: "Optional aggregate CTA clicks (30d)" },
      topPageIds: {
        type: "array",
        description: "Optional list of page ids or slugs for top pages by traffic",
        items: { type: "string" },
      },
      locale: { type: "string", description: "Locale (nb | en) for report copy" },
    },
  },
  outputSchema: {
    type: "object",
    description: "Site intelligence report",
    required: ["reportId", "generatedAt", "summary", "metrics", "recommendations", "sections"],
    properties: {
      reportId: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
      summary: { type: "string" },
      metrics: { type: "object" },
      recommendations: { type: "array", items: { type: "object" } },
      sections: { type: "array", items: { type: "object" } },
    },
  },
  safetyConstraints: [
    { code: "report_only", description: "Output is a read-only report; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(generateSiteReportCapability);

export type GenerateSiteReportInput = {
  siteName?: string | null;
  pageCount?: number | null;
  pagesWithIssues?: number | null;
  totalPageViews30d?: number | null;
  totalCtaClicks30d?: number | null;
  topPageIds?: string[] | null;
  locale?: "nb" | "en" | null;
};

export type SiteReportMetrics = {
  pageCount: number;
  pagesWithIssues: number;
  totalPageViews30d: number;
  totalCtaClicks30d: number;
  ctrPct: number | null;
};

export type SiteReportRecommendation = {
  id: string;
  priority: "low" | "medium" | "high";
  title: string;
  description: string;
};

export type SiteReportSection = {
  id: string;
  title: string;
  content: string;
};

export type GenerateSiteReportOutput = {
  reportId: string;
  generatedAt: string;
  summary: string;
  metrics: SiteReportMetrics;
  recommendations: SiteReportRecommendation[];
  sections: SiteReportSection[];
};

function reportId(): string {
  return `site-report-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generates a site intelligence report from aggregated inputs.
 * Caller supplies page count, optional issue count, optional analytics totals; this capability composes the report.
 * Deterministic; no external calls.
 */
export function generateSiteReport(input: GenerateSiteReportInput): GenerateSiteReportOutput {
  const isEn = input.locale === "en";
  const now = new Date().toISOString();
  const siteName = (input.siteName ?? "").trim() || (isEn ? "Site" : "Nettstedet");
  const pageCount = Math.max(0, Math.floor(Number(input.pageCount) ?? 0));
  const pagesWithIssues = Math.max(0, Math.floor(Number(input.pagesWithIssues) ?? 0));
  const totalPageViews30d = Math.max(0, Math.floor(Number(input.totalPageViews30d) ?? 0));
  const totalCtaClicks30d = Math.max(0, Math.floor(Number(input.totalCtaClicks30d) ?? 0));
  const ctrPct =
    totalPageViews30d > 0 ? Math.round((totalCtaClicks30d / totalPageViews30d) * 1000) / 10 : null;

  const metrics: SiteReportMetrics = {
    pageCount,
    pagesWithIssues,
    totalPageViews30d,
    totalCtaClicks30d,
    ctrPct,
  };

  const recommendations: SiteReportRecommendation[] = [];

  if (pageCount === 0) {
    recommendations.push({
      id: "rec-pages",
      priority: "high",
      title: isEn ? "Add content pages" : "Legg til innholdssider",
      description: isEn
        ? "No content pages detected. Create at least a main page and key landing pages."
        : "Ingen innholdssider funnet. Opprett minst en hovedside og viktige landingssider.",
    });
  }

  if (pagesWithIssues > 0) {
    recommendations.push({
      id: "rec-issues",
      priority: "high",
      title: isEn ? "Address content issues" : "Retting av innholdsavvik",
      description: isEn
        ? `${pagesWithIssues} page(s) have detected issues (e.g. missing intro, CTA, or low engagement). Review and fix.`
        : `${pagesWithIssues} side(r) har oppdagede avvik (f.eks. manglende intro, CTA eller lavt engasjement). Gå gjennom og rett.`,
    });
  }

  if (totalPageViews30d === 0 && pageCount > 0) {
    recommendations.push({
      id: "rec-analytics",
      priority: "medium",
      title: isEn ? "Verify analytics" : "Verifiser analytics",
      description: isEn
        ? "No page views in the last 30 days. Ensure analytics events are sent from the frontend."
        : "Ingen sidevisninger siste 30 dager. Sjekk at analytics-hendelser sendes fra frontend.",
    });
  }

  if (ctrPct !== null && ctrPct < 2 && totalPageViews30d >= 50) {
    recommendations.push({
      id: "rec-ctr",
      priority: "medium",
      title: isEn ? "Improve CTA engagement" : "Forbedre CTA-engagement",
      description: isEn
        ? `Site CTR is ${ctrPct}%. Consider clearer CTAs, placement, or copy.`
        : `Sidens CTR er ${ctrPct} %. Vurder tydeligere CTA-er, plassering eller tekst.`,
    });
  }

  recommendations.push({
    id: "rec-growth",
    priority: "low",
    title: isEn ? "Use growth content suggestions" : "Bruk vekstforslag",
    description: isEn
      ? "Run suggestGrowthContent per page or site to get topic and internal linking ideas."
      : "Kjør suggestGrowthContent per side eller for hele nettstedet for tema- og lenkeforslag.",
  });

  const sections: SiteReportSection[] = [];

  sections.push({
    id: "section-overview",
    title: isEn ? "Overview" : "Oversikt",
    content: isEn
      ? `${siteName} has ${pageCount} content page(s). ${totalPageViews30d} page views and ${totalCtaClicks30d} CTA clicks in the last 30 days.`
      : `${siteName} har ${pageCount} innholdsside(r). ${totalPageViews30d} sidevisninger og ${totalCtaClicks30d} CTA-klikk siste 30 dager.`,
  });

  sections.push({
    id: "section-metrics",
    title: isEn ? "Metrics" : "Nøkkeltall",
    content: isEn
      ? `Pages: ${pageCount}. Pages with issues: ${pagesWithIssues}. 30d views: ${totalPageViews30d}. 30d CTA clicks: ${totalCtaClicks30d}.${ctrPct != null ? ` CTR: ${ctrPct}%.` : ""}`
      : `Sider: ${pageCount}. Sider med avvik: ${pagesWithIssues}. 30d visninger: ${totalPageViews30d}. 30d CTA-klikk: ${totalCtaClicks30d}.${ctrPct != null ? ` CTR: ${ctrPct} %.` : ""}`,
  });

  sections.push({
    id: "section-recommendations",
    title: isEn ? "Top recommendations" : "Viktigste anbefalinger",
    content:
      recommendations.length > 0
        ? recommendations
            .map((r) => `[${r.priority}] ${r.title}: ${r.description}`)
            .join(" ")
        : isEn
          ? "No critical recommendations. Keep monitoring content and analytics."
          : "Ingen kritiske anbefalinger. Fortsett å overvåke innhold og analytics.",
  });

  const summary =
    recommendations.filter((r) => r.priority === "high").length > 0
      ? isEn
        ? "Site report: attention needed on content issues or missing analytics."
        : "Siderapport: oppmerksomhet på innholdsavvik eller manglende analytics."
      : isEn
        ? "Site report: no critical issues. Review recommendations for improvements."
        : "Siderapport: ingen kritiske avvik. Gå gjennom anbefalingene for forbedringer.";

  return {
    reportId: reportId(),
    generatedAt: now,
    summary,
    metrics,
    recommendations,
    sections,
  };
}

export { generateSiteReportCapability, CAPABILITY_NAME };
