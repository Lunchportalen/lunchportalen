/**
 * AI content freshness engine capability: detectOutdatedContent.
 * Flags pages as outdated by last-modified date and optional review-by date.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectOutdatedContent";

const detectOutdatedContentCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Detects outdated content by last-modified and optional review-by dates. Flags pages not updated within a given age threshold or past their review date. Returns path, reason, severity, and suggestion.",
  requiredContext: ["pages"],
  inputSchema: {
    type: "object",
    description: "Detect outdated content input",
    properties: {
      pages: {
        type: "array",
        description: "Pages to check (path, title, lastModified; optional reviewBy)",
        items: {
          type: "object",
          required: ["path", "title"],
          properties: {
            path: { type: "string" },
            title: { type: "string" },
            lastModified: { type: "string", description: "ISO date of last content update" },
            publishedAt: { type: "string", description: "Optional ISO publish date" },
            reviewBy: { type: "string", description: "Optional ISO date when content should be reviewed" },
          },
        },
      },
      maxAgeDays: {
        type: "number",
        description: "Max days since lastModified before flagging as outdated (default 365)",
      },
      includeReviewOverdue: {
        type: "boolean",
        description: "Also flag pages past reviewBy (default true)",
      },
      maxResults: { type: "number", description: "Max outdated items to return (default 50)" },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["pages"],
  },
  outputSchema: {
    type: "object",
    description: "Detected outdated content",
    required: ["outdated", "summary"],
    properties: {
      outdated: {
        type: "array",
        items: {
          type: "object",
          required: ["path", "title", "reason", "severity", "daysSinceUpdate", "suggestion"],
          properties: {
            path: { type: "string" },
            title: { type: "string" },
            reason: { type: "string", description: "age | review_overdue | both" },
            severity: { type: "string", description: "low | medium | high" },
            daysSinceUpdate: { type: "number", description: "Days since lastModified" },
            lastModified: { type: "string", description: "ISO date" },
            reviewBy: { type: "string", description: "ISO date if set" },
            suggestion: { type: "string" },
          },
        },
      },
      summary: { type: "string", description: "Short overall summary" },
    },
  },
  safetyConstraints: [
    { code: "detection_only", description: "Output is detection only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(detectOutdatedContentCapability);

export type PageForFreshnessCheck = {
  path: string;
  title: string;
  /** ISO date string of last content update. */
  lastModified?: string | null;
  /** Optional ISO publish date. */
  publishedAt?: string | null;
  /** Optional ISO date when content should be reviewed. */
  reviewBy?: string | null;
};

export type DetectOutdatedContentInput = {
  pages: PageForFreshnessCheck[];
  /** Max days since lastModified before flagging (default 365). */
  maxAgeDays?: number | null;
  /** Also flag pages past reviewBy (default true). */
  includeReviewOverdue?: boolean | null;
  /** Max outdated items to return (default 50). */
  maxResults?: number | null;
  locale?: "nb" | "en" | null;
};

export type OutdatedContentItem = {
  path: string;
  title: string;
  reason: "age" | "review_overdue" | "both";
  severity: "low" | "medium" | "high";
  daysSinceUpdate: number;
  lastModified?: string;
  reviewBy?: string;
  suggestion: string;
};

export type DetectOutdatedContentOutput = {
  outdated: OutdatedContentItem[];
  summary: string;
};

function parseDate(s: string | null | undefined): Date | null {
  if (s == null || typeof s !== "string") return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/**
 * Detects outdated content: pages not updated within maxAgeDays or past reviewBy.
 * Deterministic; no external calls.
 */
export function detectOutdatedContent(input: DetectOutdatedContentInput): DetectOutdatedContentOutput {
  const isEn = input.locale === "en";
  const pages = Array.isArray(input.pages) ? input.pages : [];
  const maxAgeDays = Math.max(1, Math.floor(Number(input.maxAgeDays) ?? 365));
  const includeReviewOverdue = input.includeReviewOverdue !== false;
  const maxResults = Math.min(100, Math.max(1, Math.floor(Number(input.maxResults) ?? 50)));
  const now = new Date();

  const outdated: OutdatedContentItem[] = [];

  for (const p of pages) {
    const path = (p.path ?? "").trim() || "/";
    const title = (p.title ?? "").trim();
    const lastMod = parseDate(p.lastModified ?? p.publishedAt);
    const reviewBy = parseDate(p.reviewBy);

    const daysSinceUpdate = lastMod ? daysBetween(lastMod, now) : maxAgeDays + 1;
    const overAge = daysSinceUpdate >= maxAgeDays;
    const reviewOverdue = includeReviewOverdue && reviewBy && reviewBy.getTime() < now.getTime();

    if (!overAge && !reviewOverdue) continue;

    let reason: "age" | "review_overdue" | "both" = "age";
    if (overAge && reviewOverdue) reason = "both";
    else if (reviewOverdue) reason = "review_overdue";

    const severity: "low" | "medium" | "high" =
      reason === "both" ? "high" : daysSinceUpdate >= maxAgeDays * 2 ? "high" : daysSinceUpdate >= maxAgeDays * 1.5 ? "medium" : "low";

    const suggestion =
      reason === "both"
        ? isEn
          ? "Update content and set a new review date."
          : "Oppdater innholdet og sett ny vurderingsdato."
        : reason === "review_overdue"
          ? isEn
            ? "Review and update content; set a new review date."
            : "Gjennomgå og oppdater innholdet; sett ny vurderingsdato."
          : isEn
            ? "Consider updating this page to keep content fresh."
            : "Vurder å oppdatere denne siden for å holde innholdet friskt.";

    outdated.push({
      path,
      title,
      reason,
      severity,
      daysSinceUpdate,
      ...(lastMod ? { lastModified: lastMod.toISOString() } : {}),
      ...(reviewBy ? { reviewBy: reviewBy.toISOString() } : {}),
      suggestion,
    });
  }

  outdated.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
  const result = outdated.slice(0, maxResults);

  const summary =
    result.length === 0
      ? isEn
        ? "No outdated content detected."
        : "Ingen utdatert innhold funnet."
      : isEn
        ? `${result.length} page(s) flagged as outdated or past review.`
        : `${result.length} side(r) markert som utdatert eller etter vurderingsdato.`;

  return { outdated: result, summary };
}

export { detectOutdatedContentCapability, CAPABILITY_NAME };
