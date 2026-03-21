/**
 * Site health AI capability: analyzeSiteHealth.
 * Analyzes aggregated site signals and returns health status (ok | degraded | critical),
 * dimension-level scores (content, structure, SEO, analytics), findings, and summary.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "analyzeSiteHealth";

const analyzeSiteHealthCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Site health AI: analyzes aggregated site signals (page count, issues, analytics, optional structure/SEO/trust signals) and returns overall status (ok | degraded | critical), dimension scores, findings, and summary. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Analyze site health input",
    properties: {
      siteName: { type: "string", description: "Optional site name" },
      pageCount: { type: "number", description: "Total content pages" },
      pagesWithIssues: { type: "number", description: "Pages with detected content/structure issues" },
      totalPageViews30d: { type: "number", description: "Optional 30d page views" },
      totalCtaClicks30d: { type: "number", description: "Optional 30d CTA clicks" },
      signals: {
        type: "object",
        description: "Optional dimension signals",
        properties: {
          avgStructureScore: { type: "number" },
          seoIssueCount: { type: "number" },
          lowTrustScoreCount: { type: "number" },
          sitemapEntryCount: { type: "number" },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Site health analysis result",
    required: ["status", "healthScore", "dimensions", "findings", "summary"],
    properties: {
      status: { type: "string", description: "ok | degraded | critical" },
      healthScore: { type: "number", description: "0-100 composite score" },
      dimensions: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "status", "score", "message"],
          properties: {
            name: { type: "string", description: "content | structure | seo | analytics | trust" },
            status: { type: "string", description: "ok | warn | fail" },
            score: { type: "number" },
            message: { type: "string" },
          },
        },
      },
      findings: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "severity", "message", "dimension"],
          properties: {
            id: { type: "string" },
            severity: { type: "string", description: "info | warn | critical" },
            message: { type: "string" },
            dimension: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      analyzedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is health analysis only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(analyzeSiteHealthCapability);

export type AnalyzeSiteHealthSignals = {
  avgStructureScore?: number | null;
  seoIssueCount?: number | null;
  lowTrustScoreCount?: number | null;
  sitemapEntryCount?: number | null;
};

export type AnalyzeSiteHealthInput = {
  siteName?: string | null;
  pageCount?: number | null;
  pagesWithIssues?: number | null;
  totalPageViews30d?: number | null;
  totalCtaClicks30d?: number | null;
  signals?: AnalyzeSiteHealthSignals | null;
  locale?: "nb" | "en" | null;
};

export type HealthDimension = {
  name: "content" | "structure" | "seo" | "analytics" | "trust";
  status: "ok" | "warn" | "fail";
  score: number;
  message: string;
};

export type HealthFinding = {
  id: string;
  severity: "info" | "warn" | "critical";
  message: string;
  dimension: string;
};

export type AnalyzeSiteHealthOutput = {
  status: "ok" | "degraded" | "critical";
  healthScore: number;
  dimensions: HealthDimension[];
  findings: HealthFinding[];
  summary: string;
  analyzedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Analyzes site health from aggregated signals. Returns status, dimensions, findings. Deterministic; no external calls.
 */
export function analyzeSiteHealth(input: AnalyzeSiteHealthInput = {}): AnalyzeSiteHealthOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const pageCount = Math.max(0, Math.floor(Number(input.pageCount) ?? 0));
  const pagesWithIssues = Math.max(0, Math.floor(Number(input.pagesWithIssues) ?? 0));
  const totalPageViews30d = Math.max(0, Math.floor(Number(input.totalPageViews30d) ?? 0));
  const totalCtaClicks30d = Math.max(0, Math.floor(Number(input.totalCtaClicks30d) ?? 0));
  const signals = input.signals && typeof input.signals === "object" ? input.signals : {};
  const avgStructure = Math.max(0, Math.min(100, Math.floor(Number(signals.avgStructureScore) ?? 100)));
  const seoIssueCount = Math.max(0, Math.floor(Number(signals.seoIssueCount) ?? 0));
  const lowTrustCount = Math.max(0, Math.floor(Number(signals.lowTrustScoreCount) ?? 0));
  const sitemapCount = Math.max(0, Math.floor(Number(signals.sitemapEntryCount) ?? pageCount));

  const dimensions: HealthDimension[] = [];
  const findings: HealthFinding[] = [];

  const contentIssuePct = pageCount > 0 ? (pagesWithIssues / pageCount) * 100 : 0;
  const contentScore = pageCount === 0 ? 0 : Math.max(0, 100 - contentIssuePct);
  const contentStatus: HealthDimension["status"] = contentScore >= 80 ? "ok" : contentScore >= 50 ? "warn" : "fail";
  dimensions.push({
    name: "content",
    status: contentStatus,
    score: Math.round(contentScore),
    message: isEn
      ? (pageCount === 0 ? "No content pages." : `${pagesWithIssues} of ${pageCount} page(s) with issues.`)
      : (pageCount === 0 ? "Ingen innholdssider." : `${pagesWithIssues} av ${pageCount} side(r) med avvik.`),
  });
  if (pageCount === 0) {
    findings.push({ id: "content-no-pages", severity: "critical", message: isEn ? "No content pages." : "Ingen innholdssider.", dimension: "content" });
  } else if (pagesWithIssues > 0) {
    findings.push({
      id: "content-issues",
      severity: contentIssuePct > 50 ? "critical" : "warn",
      message: isEn ? `${pagesWithIssues} page(s) have content or structure issues.` : `${pagesWithIssues} side(r) har innholds- eller strukturproblemer.`,
      dimension: "content",
    });
  }

  const structureStatus: HealthDimension["status"] = avgStructure >= 70 ? "ok" : avgStructure >= 50 ? "warn" : "fail";
  dimensions.push({
    name: "structure",
    status: structureStatus,
    score: avgStructure,
    message: isEn ? `Average structure score: ${avgStructure}/100.` : `Gjennomsnittlig strukturscore: ${avgStructure}/100.`,
  });
  if (avgStructure < 70) {
    findings.push({
      id: "structure-low",
      severity: avgStructure < 50 ? "critical" : "warn",
      message: isEn ? "Structure score below 70; consider improvePageStructure." : "Strukturscore under 70; vurder improvePageStructure.",
      dimension: "structure",
    });
  }

  const seoScore = seoIssueCount === 0 ? 100 : Math.max(0, 100 - seoIssueCount * 5);
  const seoStatus: HealthDimension["status"] = seoScore >= 80 ? "ok" : seoScore >= 50 ? "warn" : "fail";
  dimensions.push({
    name: "seo",
    status: seoStatus,
    score: Math.round(seoScore),
    message: isEn ? (seoIssueCount === 0 ? "No SEO issues in snapshot." : `${seoIssueCount} SEO issue(s) detected.`) : (seoIssueCount === 0 ? "Ingen SEO-problemer i snapshot." : `${seoIssueCount} SEO-problem(er) oppdaget.`),
  });
  if (seoIssueCount > 0) {
    findings.push({
      id: "seo-issues",
      severity: seoIssueCount > 10 ? "critical" : "warn",
      message: isEn ? `Address ${seoIssueCount} SEO issue(s).` : `Retting ${seoIssueCount} SEO-problem(er).`,
      dimension: "seo",
    });
  }

  const ctrPct = totalPageViews30d > 0 ? (totalCtaClicks30d / totalPageViews30d) * 100 : null;
  const analyticsScore = pageCount === 0 ? 100 : totalPageViews30d === 0 ? 30 : ctrPct != null && ctrPct < 1 && totalPageViews30d >= 50 ? 60 : 100;
  const analyticsStatus: HealthDimension["status"] = analyticsScore >= 70 ? "ok" : analyticsScore >= 40 ? "warn" : "fail";
  dimensions.push({
    name: "analytics",
    status: analyticsStatus,
    score: analyticsScore,
    message: isEn
      ? (totalPageViews30d === 0 ? "No page views in 30d." : `30d views: ${totalPageViews30d}, CTA clicks: ${totalCtaClicks30d}.${ctrPct != null ? ` CTR: ${ctrPct.toFixed(1)}%.` : ""}`)
      : (totalPageViews30d === 0 ? "Ingen sidevisninger siste 30 d." : `30d visninger: ${totalPageViews30d}, CTA-klikk: ${totalCtaClicks30d}.${ctrPct != null ? ` CTR: ${ctrPct.toFixed(1)} %.` : ""}`),
  });
  if (pageCount > 0 && totalPageViews30d === 0) {
    findings.push({ id: "analytics-no-views", severity: "warn", message: isEn ? "No page views in last 30 days." : "Ingen sidevisninger siste 30 dager.", dimension: "analytics" });
  }

  const trustScore = lowTrustCount === 0 ? 100 : Math.max(0, 100 - lowTrustCount * 10);
  const trustStatus: HealthDimension["status"] = trustScore >= 70 ? "ok" : trustScore >= 40 ? "warn" : "fail";
  dimensions.push({
    name: "trust",
    status: trustStatus,
    score: Math.round(trustScore),
    message: isEn ? (lowTrustCount === 0 ? "No low-trust pages in snapshot." : `${lowTrustCount} page(s) with low trust score.`) : (lowTrustCount === 0 ? "Ingen sider med lav tillit i snapshot." : `${lowTrustCount} side(r) med lav tillitsscore.`),
  });
  if (lowTrustCount > 0) {
    findings.push({
      id: "trust-low",
      severity: lowTrustCount > 5 ? "critical" : "warn",
      message: isEn ? `Optimize trust on ${lowTrustCount} page(s).` : `Optimaliser tillit på ${lowTrustCount} side(r).`,
      dimension: "trust",
    });
  }

  const healthScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score, 0) / Math.max(1, dimensions.length)
  );
  const hasCritical = dimensions.some((d) => d.status === "fail") || findings.some((f) => f.severity === "critical");
  const hasWarn = dimensions.some((d) => d.status === "warn") || findings.some((f) => f.severity === "warn");
  const status: AnalyzeSiteHealthOutput["status"] = hasCritical ? "critical" : hasWarn ? "degraded" : "ok";

  const summary = isEn
    ? `Site health: ${status}. Score ${healthScore}/100. ${findings.length} finding(s). ${status === "ok" ? "All dimensions within range." : "Review findings and dimensions."}`
    : `Sidehelse: ${status}. Score ${healthScore}/100. ${findings.length} funn. ${status === "ok" ? "Alle dimensjoner innenfor område." : "Gå gjennom funn og dimensjoner."}`;

  return {
    status,
    healthScore: Math.max(0, Math.min(100, healthScore)),
    dimensions,
    findings,
    summary,
    analyzedAt: new Date().toISOString(),
  };
}

export { analyzeSiteHealthCapability, CAPABILITY_NAME };
