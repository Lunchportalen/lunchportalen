/**
 * Autonomous improvement engine capability: autoImproveSite.
 * Runs periodic site-wide analysis and returns a prioritized improvement plan:
 * structure, SEO, trust, content, navigation. Consumes aggregated snapshot; outputs actions and next-run hint.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "autoImproveSite";

const autoImproveSiteCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Autonomous improvement engine: runs periodic site-wide analysis. Consumes aggregated snapshot (page count, issues, optional scores). Returns prioritized improvement plan (structure, SEO, trust, content, navigation), recommended actions, and next-run hint. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Auto-improve site input (periodic analysis snapshot)",
    properties: {
      siteName: { type: "string", description: "Optional site name" },
      pageCount: { type: "number", description: "Total content pages" },
      pagesWithIssues: { type: "number", description: "Pages with detected issues" },
      lastRunAt: { type: "string", description: "Optional ISO timestamp of last analysis run" },
      scopes: {
        type: "array",
        description: "Analysis scopes: structure | seo | trust | content | navigation (default all)",
        items: { type: "string" },
      },
      signals: {
        type: "object",
        description: "Optional pre-aggregated signals (e.g. avgStructureScore, pagesWithoutHero, lowTrustCount)",
        properties: {
          avgStructureScore: { type: "number" },
          pagesWithoutHero: { type: "number" },
          pagesWithoutCta: { type: "number" },
          lowTrustScoreCount: { type: "number" },
          seoIssueCount: { type: "number" },
          navItemCount: { type: "number" },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Autonomous improvement plan",
    required: ["runId", "generatedAt", "plan", "summary", "nextRunHint"],
    properties: {
      runId: { type: "string", description: "Unique run identifier" },
      generatedAt: { type: "string", description: "ISO timestamp" },
      plan: {
        type: "array",
        description: "Prioritized improvement areas with actions",
        items: {
          type: "object",
          required: ["scope", "priority", "actions", "rationale"],
          properties: {
            scope: { type: "string", description: "structure | seo | trust | content | navigation" },
            priority: { type: "string", description: "high | medium | low" },
            actions: { type: "array", items: { type: "string" } },
            rationale: { type: "string" },
            capabilityHint: { type: "string", description: "Suggested capability to run (e.g. improvePageStructure)" },
          },
        },
      },
      summary: { type: "string" },
      nextRunHint: { type: "string", description: "Suggested interval for next periodic run (e.g. 7 days)" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is improvement plan only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(autoImproveSiteCapability);

export type AutoImproveSiteSignals = {
  avgStructureScore?: number | null;
  pagesWithoutHero?: number | null;
  pagesWithoutCta?: number | null;
  lowTrustScoreCount?: number | null;
  seoIssueCount?: number | null;
  navItemCount?: number | null;
};

export type AutoImproveSiteInput = {
  siteName?: string | null;
  pageCount?: number | null;
  pagesWithIssues?: number | null;
  lastRunAt?: string | null;
  scopes?: ("structure" | "seo" | "trust" | "content" | "navigation")[] | null;
  signals?: AutoImproveSiteSignals | null;
  locale?: "nb" | "en" | null;
};

export type ImprovementPlanItem = {
  scope: "structure" | "seo" | "trust" | "content" | "navigation";
  priority: "high" | "medium" | "low";
  actions: string[];
  rationale: string;
  capabilityHint?: string | null;
};

export type AutoImproveSiteOutput = {
  runId: string;
  generatedAt: string;
  plan: ImprovementPlanItem[];
  summary: string;
  nextRunHint: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function runId(): string {
  return `auto-improve-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Runs periodic site analysis and returns prioritized improvement plan. Deterministic; no external calls.
 */
export function autoImproveSite(input: AutoImproveSiteInput = {}): AutoImproveSiteOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const pageCount = Math.max(0, Math.floor(Number(input.pageCount) ?? 0));
  const pagesWithIssues = Math.max(0, Math.floor(Number(input.pagesWithIssues) ?? 0));
  const signals = input.signals && typeof input.signals === "object" ? input.signals : {};
  const avgStructure = Math.max(0, Math.min(100, Math.floor(Number(signals.avgStructureScore) ?? 100)));
  const pagesWithoutHero = Math.max(0, Math.floor(Number(signals.pagesWithoutHero) ?? 0));
  const pagesWithoutCta = Math.max(0, Math.floor(Number(signals.pagesWithoutCta) ?? 0));
  const lowTrustCount = Math.max(0, Math.floor(Number(signals.lowTrustScoreCount) ?? 0));
  const seoIssueCount = Math.max(0, Math.floor(Number(signals.seoIssueCount) ?? 0));

  const requestedScopes = Array.isArray(input.scopes)
    ? input.scopes.filter((s) => typeof s === "string" && ["structure", "seo", "trust", "content", "navigation"].includes((s as string).toLowerCase())) as ImprovementPlanItem["scope"][]
    : (["structure", "seo", "trust", "content", "navigation"] as ImprovementPlanItem["scope"][]);

  const plan: ImprovementPlanItem[] = [];

  if (requestedScopes.includes("structure")) {
    const actions: string[] = [];
    let rationale = "";
    let priority: ImprovementPlanItem["priority"] = "low";
    if (pageCount > 0 && (pagesWithoutHero > 0 || pagesWithoutCta > 0)) {
      priority = "high";
      if (pagesWithoutHero > 0) {
        actions.push(isEn ? `Add hero block to ${pagesWithoutHero} page(s) missing it.` : `Legg til hero-blokk på ${pagesWithoutHero} side(r) som mangler.`);
      }
      if (pagesWithoutCta > 0) {
        actions.push(isEn ? `Add CTA block to ${pagesWithoutCta} page(s) missing it.` : `Legg til CTA-blokk på ${pagesWithoutCta} side(r) som mangler.`);
      }
      rationale = isEn ? "Pages lack hero or CTA; structure affects conversion." : "Sider mangler hero eller CTA; struktur påvirker konvertering.";
    } else if (avgStructure < 70) {
      priority = "medium";
      actions.push(isEn ? "Run structure improvement on pages with score below 70." : "Kjør strukturforbedring på sider med score under 70.");
      rationale = isEn ? "Average structure score is below 70." : "Gjennomsnittlig strukturscore er under 70.";
    } else {
      actions.push(isEn ? "Keep monitoring structure; no critical gaps." : "Overvåk struktur; ingen kritiske hull.");
      rationale = isEn ? "Structure signals are acceptable." : "Struktursignaler er akseptable.";
    }
    plan.push({
      scope: "structure",
      priority,
      actions,
      rationale,
      capabilityHint: "improvePageStructure",
    });
  }

  if (requestedScopes.includes("seo")) {
    const actions: string[] = [];
    const priority: ImprovementPlanItem["priority"] = seoIssueCount > 0 ? (seoIssueCount > 5 ? "high" : "medium") : "low";
    if (seoIssueCount > 0) {
      actions.push(isEn ? `Address SEO issues on ${seoIssueCount} page(s).` : `Ta tak i SEO-problemer på ${seoIssueCount} side(r).`);
    } else {
      actions.push(isEn ? "No SEO issues in snapshot; keep monitoring." : "Ingen SEO-problemer i snapshot; fortsett overvåking.");
    }
    plan.push({
      scope: "seo",
      priority,
      actions,
      rationale: isEn ? (seoIssueCount > 0 ? "SEO issues affect discoverability and conversion." : "SEO signals within range.") : (seoIssueCount > 0 ? "SEO-problemer påvirker synlighet og konvertering." : "SEO-signaler innenfor område."),
      capabilityHint: "seoImprove",
    });
  }

  if (requestedScopes.includes("trust")) {
    const actions: string[] = [];
    const priority: ImprovementPlanItem["priority"] = lowTrustCount > 0 ? "high" : "low";
    if (lowTrustCount > 0) {
      actions.push(isEn ? `Run trust optimizer on ${lowTrustCount} page(s) with low trust score.` : `Kjør tillitsoptimalisering på ${lowTrustCount} side(r) med lav tillitsscore.`);
    } else {
      actions.push(isEn ? "Trust signals acceptable; no action required." : "Tillitssignaler akseptable; ingen tiltak nødvendig.");
    }
    plan.push({
      scope: "trust",
      priority,
      actions,
      rationale: isEn ? (lowTrustCount > 0 ? "Low trust score can reduce conversion." : "Trust signals in range.") : (lowTrustCount > 0 ? "Lav tillitsscore kan redusere konvertering." : "Tillitssignaler innenfor område."),
      capabilityHint: "optimizeProductTrust",
    });
  }

  if (requestedScopes.includes("content")) {
    const actions: string[] = [];
    const priority: ImprovementPlanItem["priority"] = pagesWithIssues > 0 ? (pagesWithIssues > pageCount / 2 ? "high" : "medium") : "low";
    if (pagesWithIssues > 0) {
      actions.push(isEn ? `Run content quality check on ${pagesWithIssues} page(s) with issues.` : `Kjør innholdskvalitetsjekk på ${pagesWithIssues} side(r) med problemer.`);
    } else {
      actions.push(isEn ? "No content issues in snapshot." : "Ingen innholdsproblemer i snapshot.");
    }
    plan.push({
      scope: "content",
      priority,
      actions,
      rationale: isEn ? (pagesWithIssues > 0 ? "Content issues affect clarity and conversion." : "Content health OK.") : (pagesWithIssues > 0 ? "Innholdsproblemer påvirker tydelighet og konvertering." : "Innholdshelse OK."),
      capabilityHint: "validatePageQuality",
    });
  }

  if (requestedScopes.includes("navigation")) {
    const actions: string[] = [];
    plan.push({
      scope: "navigation",
      priority: "low",
      actions: [isEn ? "Review navigation structure periodically (cognitive load, discoverability)." : "Gjennomgå navigasjonsstruktur periodisk (kognitiv belastning, synlighet)."],
      rationale: isEn ? "Navigation affects findability and flow." : "Navigasjon påvirker finnbarhet og flyt.",
      capabilityHint: "suggestNavigationStructure",
    });
  }

  plan.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
  });

  const highCount = plan.filter((p) => p.priority === "high").length;
  const summary = isEn
    ? `Periodic analysis: ${plan.length} scope(s). ${highCount} high-priority area(s). ${pageCount} page(s), ${pagesWithIssues} with issues. Run recommended actions and re-run in 7 days.`
    : `Periodisk analyse: ${plan.length} område(r). ${highCount} høyprioriterte. ${pageCount} side(r), ${pagesWithIssues} med problemer. Kjør anbefalte tiltak og kjør på nytt om 7 dager.`;

  const nextRunHint = isEn ? "Run again in 7 days for periodic analysis." : "Kjør på nytt om 7 dager for periodisk analyse.";

  return {
    runId: runId(),
    generatedAt: new Date().toISOString(),
    plan,
    summary,
    nextRunHint,
  };
}

export { autoImproveSiteCapability, CAPABILITY_NAME };
