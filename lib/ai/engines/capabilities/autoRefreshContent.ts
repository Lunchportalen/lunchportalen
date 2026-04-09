/**
 * AI content refresh engine capability: autoRefreshContent.
 * Produces a refresh plan from page list: identifies content to refresh (stale, review overdue,
 * low quality, low engagement) and suggests actions (full refresh, update sections, review only).
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "autoRefreshContent";

const autoRefreshContentCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "AI content refresh engine: produces a refresh plan from page list. Identifies content to refresh (stale, review overdue, low quality, low engagement) and suggests actions (full refresh, update sections, review only). Returns prioritized plan and summary. Deterministic; no LLM.",
  requiredContext: ["pages"],
  inputSchema: {
    type: "object",
    description: "Auto refresh content input",
    properties: {
      pages: {
        type: "array",
        description: "Pages to evaluate (path, title, lastModified; optional reviewBy, qualityScore, pageViews30d)",
        items: {
          type: "object",
          required: ["path", "title"],
          properties: {
            path: { type: "string" },
            title: { type: "string" },
            lastModified: { type: "string", description: "ISO date of last update" },
            reviewBy: { type: "string", description: "Optional ISO review-by date" },
            qualityScore: { type: "number", description: "Optional 0-100 quality score" },
            pageViews30d: { type: "number", description: "Optional 30d page views" },
          },
        },
      },
      maxAgeDays: { type: "number", description: "Max days since lastModified before stale (default 365)" },
      includeReviewOverdue: { type: "boolean", description: "Include pages past reviewBy (default true)" },
      lowQualityThreshold: { type: "number", description: "Flag refresh if qualityScore below this (default 60)" },
      lowEngagementThreshold: { type: "number", description: "Flag if pageViews30d below this and other pages have traffic (default 10)" },
      maxItems: { type: "number", description: "Max items in refresh plan (default 50)" },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["pages"],
  },
  outputSchema: {
    type: "object",
    description: "Content refresh plan",
    required: ["refreshPlan", "summary"],
    properties: {
      refreshPlan: {
        type: "array",
        items: {
          type: "object",
          required: ["path", "title", "reason", "priority", "suggestedAction"],
          properties: {
            path: { type: "string" },
            title: { type: "string" },
            reason: { type: "string", description: "stale | review_overdue | low_quality | low_engagement" },
            priority: { type: "string", description: "high | medium | low" },
            suggestedAction: { type: "string", description: "full_refresh | update_sections | review_only" },
            daysSinceUpdate: { type: "number" },
            capabilityHint: { type: "string", description: "e.g. validatePageQuality, improvePageStructure" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is refresh plan only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(autoRefreshContentCapability);

export type PageForRefreshCheck = {
  path: string;
  title: string;
  lastModified?: string | null;
  reviewBy?: string | null;
  qualityScore?: number | null;
  pageViews30d?: number | null;
};

export type AutoRefreshContentInput = {
  pages: PageForRefreshCheck[];
  maxAgeDays?: number | null;
  includeReviewOverdue?: boolean | null;
  lowQualityThreshold?: number | null;
  lowEngagementThreshold?: number | null;
  maxItems?: number | null;
  locale?: "nb" | "en" | null;
};

export type RefreshPlanItem = {
  path: string;
  title: string;
  reason: "stale" | "review_overdue" | "low_quality" | "low_engagement";
  priority: "high" | "medium" | "low";
  suggestedAction: "full_refresh" | "update_sections" | "review_only";
  daysSinceUpdate?: number | null;
  capabilityHint?: string | null;
};

export type AutoRefreshContentOutput = {
  refreshPlan: RefreshPlanItem[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseDate(s: string | undefined | null): Date | null {
  if (!s || typeof s !== "string") return null;
  const d = new Date(s.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Produces a content refresh plan from page list. Deterministic; no external calls.
 */
export function autoRefreshContent(input: AutoRefreshContentInput): AutoRefreshContentOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const maxAgeDays = Math.max(30, Math.floor(Number(input.maxAgeDays) ?? 365));
  const includeReviewOverdue = input.includeReviewOverdue !== false;
  const lowQualityThreshold = Math.max(0, Math.min(100, Math.floor(Number(input.lowQualityThreshold) ?? 60)));
  const lowEngagementThreshold = Math.max(0, Math.floor(Number(input.lowEngagementThreshold) ?? 10));
  const maxItems = Math.min(100, Math.max(1, Math.floor(Number(input.maxItems) ?? 50)));

  const now = new Date();
  const pages = Array.isArray(input.pages)
    ? input.pages.filter(
        (p): p is PageForRefreshCheck =>
          p != null && typeof p === "object" && typeof (p as PageForRefreshCheck).path === "string" && typeof (p as PageForRefreshCheck).title === "string"
      )
    : [];

  const refreshPlan: RefreshPlanItem[] = [];
  const seen = new Set<string>();

  const add = (
    path: string,
    title: string,
    reason: RefreshPlanItem["reason"],
    priority: RefreshPlanItem["priority"],
    suggestedAction: RefreshPlanItem["suggestedAction"],
    opts?: { daysSinceUpdate?: number; capabilityHint?: string }
  ) => {
    const key = path;
    if (seen.has(key) || refreshPlan.length >= maxItems) return;
    seen.add(key);
    refreshPlan.push({
      path,
      title,
      reason,
      priority,
      suggestedAction,
      daysSinceUpdate: opts?.daysSinceUpdate ?? undefined,
      capabilityHint: opts?.capabilityHint ?? undefined,
    });
  };

  const viewsList = pages.map((p) => Math.max(0, Math.floor(Number(p.pageViews30d) ?? 0)));
  const hasTraffic = viewsList.some((v) => v > lowEngagementThreshold);

  for (const p of pages) {
    const path = safeStr(p.path) || "/";
    const title = safeStr(p.title) || (isEn ? "Page" : "Side");
    const lastMod = parseDate(p.lastModified);
    const reviewBy = parseDate(p.reviewBy);
    const qualityScore = typeof p.qualityScore === "number" && !Number.isNaN(p.qualityScore) ? p.qualityScore : null;
    const pageViews30d = Math.max(0, Math.floor(Number(p.pageViews30d) ?? 0));

    const daysSinceUpdate = lastMod ? daysBetween(lastMod, now) : null;
    const isStale = daysSinceUpdate != null && daysSinceUpdate > maxAgeDays;
    const isReviewOverdue = includeReviewOverdue && reviewBy && reviewBy.getTime() < now.getTime();
    const isLowQuality = qualityScore != null && qualityScore < lowQualityThreshold;
    const isLowEngagement = hasTraffic && pageViews30d < lowEngagementThreshold && pageViews30d >= 0;

    if (isReviewOverdue) {
      add(path, title, "review_overdue", "high", "full_refresh", { daysSinceUpdate: daysSinceUpdate ?? undefined, capabilityHint: "validatePageQuality" });
    } else if (isStale) {
      add(path, title, "stale", daysSinceUpdate != null && daysSinceUpdate > maxAgeDays * 2 ? "high" : "medium", "full_refresh", { daysSinceUpdate: daysSinceUpdate ?? undefined, capabilityHint: "improvePageStructure" });
    } else if (isLowQuality) {
      add(path, title, "low_quality", "medium", "update_sections", { capabilityHint: "validatePageQuality" });
    } else if (isLowEngagement) {
      add(path, title, "low_engagement", "low", "review_only", { capabilityHint: "analyzePageConversion" });
    }
  }

  refreshPlan.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
  });

  const summary = isEn
    ? `Refresh plan: ${refreshPlan.length} item(s). ${refreshPlan.length === 0 ? "No content flagged for refresh." : "Review and run suggested actions."}`
    : `Oppdateringsplan: ${refreshPlan.length} element(er). ${refreshPlan.length === 0 ? "Ingen innhold merket for oppdatering." : "Gå gjennom og kjør anbefalte tiltak."}`;

  return {
    refreshPlan,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { autoRefreshContentCapability, CAPABILITY_NAME };
