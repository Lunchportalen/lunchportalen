/**
 * SEO Intelligence Loop — deterministic page-level scoring and suggestions.
 * No AI required; safe fallback when AI is disabled. Used by backoffice SEO panel.
 * Suggestions only; no silent mutation. Persist recommendations in meta.seoRecommendations.
 *
 * Scoring is derived from page-analysis engine (lib/seo/pageAnalysis.ts). Apply is deterministic:
 * only metaField "seo.title" and "seo.description" are writable; values are clamped to MAX_*.
 * Invalid merge input (missing score or suggestions array) leaves meta unchanged.
 *
 * Patch model (apply safety):
 * - Apply updates only meta.seo.title or meta.seo.description (allowlist); unknown metaField is no-op.
 * - Reject (dismiss) updates only suggestion status; meta.seo and body/blocks unchanged.
 * - No direct overwrite of page body or blocks; only structured meta patch.
 */

import { analyzePageForSeo } from "@/lib/seo/pageAnalysis";
import { computeSeoScore, type SeoScoreBreakdown } from "@/lib/seo/scoring";
import { buildSeoSuggestions } from "@/lib/seo/suggestions";

export const SEO_INTELLIGENCE_CONSTANTS = {
  MAX_TITLE: 120,
  MAX_DESC: 320,
  RECOMMENDED_TITLE_MIN: 50,
  RECOMMENDED_TITLE_MAX: 60,
  RECOMMENDED_DESC_MIN: 155,
  RECOMMENDED_DESC_MAX: 160,
  TITLE_SUFFIX: " – Lunchportalen",
} as const;

export type SeoRecommendationType =
  | "title_improvement"
  | "meta_description_improvement"
  | "heading_hierarchy"
  | "content_depth"
  | "internal_linking"
  | "missing_structured_content"
  | "weak_cta_intent"
  | "image_alt_missing"
  | "keyword_topic";

export type SeoRecommendationStatus = "pending" | "applied" | "dismissed";

export type SeoRecommendation = {
  id: string;
  type: SeoRecommendationType;
  /** Short label for UI (e.g. "SEO-tittel"). */
  label: string;
  /** Current value or summary (before). */
  before: string;
  /** Suggested value or action description. */
  suggested: string;
  /** Why this suggestion helps; references page context. Optional when parsing legacy data. */
  explanation?: string;
  priority: "high" | "medium" | "low";
  status: SeoRecommendationStatus;
  /** Optional: field key to apply into meta (e.g. "seo.title", "seo.description"). Only title/description are auto-applicable; keyword_topic is applied manually in AI & mål. */
  metaField?: string;
};

export type SeoRecommendationsState = {
  lastScoredAt: string;
  score: number;
  suggestions: SeoRecommendation[];
};

export type SeoIntelligenceInput = {
  blocks: Array<{ id: string; type: string; data?: Record<string, unknown> }>;
  meta?: Record<string, unknown>;
  pageTitle?: string;
  locale?: string;
  goal?: "lead" | "info" | "signup";
  brand?: string;
};

export type SeoIntelligenceResult = {
  score: number;
  suggestions: SeoRecommendation[];
  message: string;
  /** Per-category deductions (from scoring engine). Present when score is computed from analysis. */
  breakdown?: SeoScoreBreakdown;
};

function safeStr(v: unknown): string {
  if (v == null) return "";
  return (typeof v === "string" ? v : String(v)).trim();
}

function newRecommendationId(): string {
  return `seo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Deterministic SEO score (0–100) and suggestions. No AI; safe when provider unavailable.
 * Uses page-analysis and suggestion engine. Suggestions are structured (type, suggested change, explanation).
 * Content is never overwritten automatically; user must apply each suggestion explicitly.
 */
export function computeSeoIntelligence(input: SeoIntelligenceInput): SeoIntelligenceResult {
  const locale = input.locale === "en" ? "en" : "nb";
  const brand = (input.brand || "Lunchportalen").trim();
  const goal = input.goal === "info" || input.goal === "signup" ? input.goal : "lead";
  const analysis = analyzePageForSeo({
    blocks: input.blocks,
    meta: input.meta,
    pageTitle: input.pageTitle,
  });
  const pageTitle = input.pageTitle?.trim() ?? "";
  const intent = input.meta && typeof input.meta === "object" && !Array.isArray(input.meta)
    ? (input.meta as Record<string, unknown>).intent
    : undefined;
  const intentObj = intent != null && typeof intent === "object" && !Array.isArray(intent) ? (intent as Record<string, unknown>) : undefined;
  const primaryKeyword = typeof intentObj?.primaryKeyword === "string" ? intentObj.primaryKeyword.trim() : "";

  const scoreResult = computeSeoScore({ analysis, primaryKeyword: primaryKeyword || null });
  const { suggestions: items } = buildSeoSuggestions(analysis, {
    locale,
    brand,
    goal,
    pageTitle,
    primaryKeyword,
  });

  const suggestions: SeoRecommendation[] = items.map((item) => ({
    id: newRecommendationId(),
    type: item.type as SeoRecommendationType,
    label: item.label,
    before: item.before,
    suggested: item.suggested,
    explanation: item.explanation,
    priority: item.priority,
    status: "pending" as const,
    ...(item.metaField && { metaField: item.metaField }),
  }));

  const message =
    locale === "en"
      ? `Score: ${scoreResult.score}/100. ${suggestions.length} suggestion(s).`
      : `Score: ${scoreResult.score}/100. ${suggestions.length} forslag.`;

  return {
    score: scoreResult.score,
    suggestions,
    message,
    breakdown: scoreResult.breakdown,
  };
}

/**
 * Parse persisted meta.seoRecommendations from body.meta. Safe for missing or invalid data.
 */
export function parseSeoRecommendationsFromMeta(meta: unknown): SeoRecommendationsState | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const root = meta as Record<string, unknown>;
  const rec = root.seoRecommendations;
  if (!rec || typeof rec !== "object" || Array.isArray(rec)) return null;
  const r = rec as Record<string, unknown>;
  const lastScoredAt = typeof r.lastScoredAt === "string" ? r.lastScoredAt : "";
  const score = typeof r.score === "number" ? Math.max(0, Math.min(100, r.score)) : 0;
  const arr = Array.isArray(r.suggestions) ? r.suggestions : [];
  const suggestions = arr
    .filter((s): s is Record<string, unknown> => s != null && typeof s === "object" && !Array.isArray(s))
    .map((s) => ({
      id: typeof s.id === "string" ? s.id : newRecommendationId(),
      type: (typeof s.type === "string" ? s.type : "title_improvement") as SeoRecommendationType,
      label: typeof s.label === "string" ? s.label : "",
      before: typeof s.before === "string" ? s.before : "",
      suggested: typeof s.suggested === "string" ? s.suggested : "",
      explanation: typeof s.explanation === "string" ? s.explanation : "",
      priority: (s.priority === "high" || s.priority === "low" ? s.priority : "medium") as "high" | "medium" | "low",
      status: (s.status === "applied" || s.status === "dismissed" ? s.status : "pending") as SeoRecommendationStatus,
      metaField: typeof s.metaField === "string" ? s.metaField : undefined,
    }));
  return { lastScoredAt, score, suggestions };
}

/**
 * Build meta.seoRecommendations for persistence. Preserves existing applied/dismissed status by id.
 */
export function mergeSeoRecommendationsIntoMeta(
  meta: Record<string, unknown>,
  result: SeoIntelligenceResult,
  existingState: SeoRecommendationsState | null
): Record<string, unknown> {
  const statusById = new Map<string, SeoRecommendationStatus>();
  if (existingState?.suggestions) {
    for (const s of existingState.suggestions) {
      statusById.set(s.id, s.status);
    }
  }
  const suggestions: SeoRecommendation[] = result.suggestions.map((s) => ({
    ...s,
    status: statusById.get(s.id) ?? "pending",
  }));
  const next = { ...meta };
  const prevSeoRec = next.seoRecommendations != null && typeof next.seoRecommendations === "object" && !Array.isArray(next.seoRecommendations)
    ? (next.seoRecommendations as Record<string, unknown>)
    : {};
  next.seoRecommendations = {
    ...prevSeoRec,
    lastScoredAt: new Date().toISOString(),
    score: result.score,
    suggestions,
  };
  return next;
}

function safeObj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

/** Only these meta keys may be written by apply. No body/blocks; no other meta keys. */
const ALLOWED_META_FIELDS: readonly string[] = ["seo.title", "seo.description"];

export type ApplySeoRecommendationResult = {
  nextMeta: Record<string, unknown>;
  applied: boolean;
};

/**
 * Apply a single recommendation into meta (write suggested value to seo.title/description and mark as applied).
 * Patch safety: only ALLOWED_META_FIELDS are written; suggested value is clamped to MAX_TITLE/MAX_DESC.
 * Stale safety: if current value for the field does not match rec.before, returns applied: false and nextMeta unchanged.
 * Unknown or malformed metaField is no-op. Never touches body/blocks.
 */
export function applySeoRecommendationToMeta(
  meta: Record<string, unknown>,
  rec: SeoRecommendation
): ApplySeoRecommendationResult {
  const metaField = typeof rec.metaField === "string" ? rec.metaField : "";
  if (!ALLOWED_META_FIELDS.includes(metaField)) {
    return { nextMeta: { ...meta }, applied: false };
  }
  const prevSeo = safeObj(meta.seo);
  const beforeNorm = typeof rec.before === "string" ? rec.before.trim() : "";
  const currentTitle = typeof prevSeo.title === "string" ? prevSeo.title.trim() : "";
  const currentDesc = typeof prevSeo.description === "string" ? prevSeo.description.trim() : "";
  if (metaField === "seo.title" && currentTitle !== beforeNorm) {
    return { nextMeta: { ...meta }, applied: false };
  }
  if (metaField === "seo.description" && currentDesc !== beforeNorm) {
    return { nextMeta: { ...meta }, applied: false };
  }
  const next = { ...meta };
  const suggested = typeof rec.suggested === "string" ? rec.suggested.trim() : "";
  if (metaField === "seo.title") {
    next.seo = { ...prevSeo, title: suggested.slice(0, SEO_INTELLIGENCE_CONSTANTS.MAX_TITLE) };
  } else if (metaField === "seo.description") {
    next.seo = { ...prevSeo, description: suggested.slice(0, SEO_INTELLIGENCE_CONSTANTS.MAX_DESC) };
  }
  const recState = next.seoRecommendations as { suggestions?: unknown[] } | undefined;
  if (recState != null && typeof recState === "object" && !Array.isArray(recState)) {
    const suggestions = Array.isArray(recState.suggestions)
      ? (recState.suggestions as SeoRecommendation[]).map((s) =>
          s.id === rec.id ? { ...s, status: "applied" as const } : s
        )
      : [];
    next.seoRecommendations = { ...recState, suggestions };
  }
  return { nextMeta: next, applied: true };
}

/**
 * Mark a recommendation as dismissed in meta.seoRecommendations.
 * Reject safety: only updates suggestion status to "dismissed"; meta.seo and all other content unchanged.
 */
export function dismissSeoRecommendationInMeta(
  meta: Record<string, unknown>,
  rec: SeoRecommendation
): Record<string, unknown> {
  const next = { ...meta };
  const recState = next.seoRecommendations as { suggestions?: unknown[] } | undefined;
  if (recState != null && typeof recState === "object" && !Array.isArray(recState)) {
    const suggestions = Array.isArray(recState.suggestions)
      ? (recState.suggestions as SeoRecommendation[]).map((s) =>
          s.id === rec.id ? { ...s, status: "dismissed" as const } : s
        )
      : [];
    next.seoRecommendations = { ...recState, suggestions };
  }
  return next;
}
