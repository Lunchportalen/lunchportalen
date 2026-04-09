/**
 * Recommendation engine capability: suggestNextContent.
 * Suggests next content from current item and candidate pool: same category,
 * similar tags, popular, or continuation. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "suggestNextContent";

const suggestNextContentCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Recommendation engine: suggests next content from current item and candidate pool. Returns ranked suggestions by same category, similar tags, popularity, or continuation. Excludes current and optionally recently viewed. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Suggest next content input",
    properties: {
      currentContent: {
        type: "object",
        description: "Content being viewed or just finished",
        properties: {
          contentId: { type: "string" },
          title: { type: "string" },
          category: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
      candidates: {
        type: "array",
        description: "Candidate content items to recommend",
        items: {
          type: "object",
          required: ["contentId", "title"],
          properties: {
            contentId: { type: "string" },
            title: { type: "string" },
            category: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            viewCount: { type: "number" },
            completedCount: { type: "number" },
          },
        },
      },
      recentlyViewedIds: {
        type: "array",
        description: "Content IDs to deprioritize or exclude",
        items: { type: "string" },
      },
      maxSuggestions: { type: "number", description: "Max suggestions (default: 6)" },
      locale: { type: "string", description: "Locale (nb | en) for reason copy" },
    },
    required: ["candidates"],
  },
  outputSchema: {
    type: "object",
    description: "Next content recommendations",
    required: ["suggestions", "summary", "generatedAt"],
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          required: ["contentId", "title", "reason", "priority", "recommendationType"],
          properties: {
            contentId: { type: "string" },
            title: { type: "string" },
            category: { type: "string" },
            reason: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            recommendationType: {
              type: "string",
              enum: ["same_category", "similar_tags", "popular", "continuation", "discovery"],
            },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is recommendations only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestNextContentCapability);

export type CurrentContentContext = {
  contentId?: string | null;
  title?: string | null;
  category?: string | null;
  tags?: string[] | null;
};

export type ContentCandidate = {
  contentId: string;
  title: string;
  category?: string | null;
  tags?: string[] | null;
  viewCount?: number | null;
  completedCount?: number | null;
};

export type SuggestNextContentInput = {
  currentContent?: CurrentContentContext | null;
  candidates: ContentCandidate[];
  recentlyViewedIds?: string[] | null;
  maxSuggestions?: number | null;
  locale?: "nb" | "en" | null;
};

export type NextContentSuggestion = {
  contentId: string;
  title: string;
  category?: string | null;
  reason: string;
  priority: "high" | "medium" | "low";
  recommendationType: "same_category" | "similar_tags" | "popular" | "continuation" | "discovery";
};

export type SuggestNextContentOutput = {
  suggestions: NextContentSuggestion[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map((x) => x.trim().toLowerCase()).filter(Boolean);
}

function tagOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  return a.filter((t) => setB.has(t)).length;
}

/**
 * Recommends next content from candidates by category, tags, and popularity. Deterministic; no external calls.
 */
export function suggestNextContent(input: SuggestNextContentInput): SuggestNextContentOutput {
  const current = input.currentContent && typeof input.currentContent === "object" ? input.currentContent : null;
  const candidates = Array.isArray(input.candidates) ? input.candidates : [];
  const recentSet = new Set(
    Array.isArray(input.recentlyViewedIds) ? input.recentlyViewedIds.map((id) => String(id).trim()).filter(Boolean) : []
  );
  const max = Math.max(0, Math.min(24, Number(input.maxSuggestions) || 6));
  const isEn = input.locale === "en";
  const currentId = current ? safeStr(current.contentId).toLowerCase() : "";
  const currentCategory = current ? safeStr(current.category).toLowerCase() : "";
  const currentTags = current ? safeTags(current.tags) : [];

  type Scored = { candidate: ContentCandidate; score: number; type: NextContentSuggestion["recommendationType"] };
  const scored: Scored[] = [];

  for (const c of candidates) {
    const id = safeStr(c.contentId).toLowerCase();
    if (!id || id === currentId) continue;
    if (recentSet.has(id)) continue;

    const title = safeStr(c.title) || id;
    const cat = safeStr(c.category).toLowerCase();
    const tags = safeTags(c.tags);
    const views = typeof c.viewCount === "number" && c.viewCount >= 0 ? c.viewCount : 0;
    const completed = typeof c.completedCount === "number" && c.completedCount >= 0 ? c.completedCount : 0;

    let score = 0;
    let type: NextContentSuggestion["recommendationType"] = "discovery";

    if (currentCategory && cat && cat === currentCategory) {
      score += 20;
      type = "same_category";
    }
    const overlap = tagOverlap(currentTags, tags);
    if (overlap > 0) {
      score += 10 + overlap * 3;
      if (overlap >= 2 && type === "discovery") type = "similar_tags";
      else if (type === "discovery") type = "similar_tags";
    }
    if (views > 0 || completed > 0) {
      score += Math.min(15, Math.log10(views + completed + 1) * 4);
      if (score <= 15 && type === "discovery") type = "popular";
    }
    if (completed > 0 && type === "discovery") type = "continuation";

    scored.push({ candidate: c, score, type });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, max);

  const reasonKey: Record<NextContentSuggestion["recommendationType"], { en: string; nb: string }> = {
    same_category: { en: "Same category", nb: "Samme kategori" },
    similar_tags: { en: "Similar topics", nb: "Lignende temaer" },
    popular: { en: "Popular", nb: "Populær" },
    continuation: { en: "Often viewed next", nb: "Ofte sett deretter" },
    discovery: { en: "Recommended for you", nb: "Anbefalt til deg" },
  };

  const suggestions: NextContentSuggestion[] = top.map(({ candidate, score, type }) => {
    const priority: "high" | "medium" | "low" = score >= 25 ? "high" : score >= 12 ? "medium" : "low";
    const labels = reasonKey[type];
    const reason = isEn ? labels.en : labels.nb;
    return {
      contentId: candidate.contentId,
      title: safeStr(candidate.title) || candidate.contentId,
      category: candidate.category ?? undefined,
      reason,
      priority,
      recommendationType: type,
    };
  });

  const summary = isEn
    ? `Recommended ${suggestions.length} next content item(s) from ${candidates.length} candidate(s).`
    : `Anbefalte ${suggestions.length} neste innholdsdel(er) fra ${candidates.length} kandidat(er).`;

  return {
    suggestions,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { suggestNextContentCapability, CAPABILITY_NAME };
