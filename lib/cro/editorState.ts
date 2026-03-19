/**
 * CRO editor state: parse/merge/dismiss CRO recommendations persisted in body.meta.croRecommendations.
 * Single source for editor integration; no auto-apply.
 */

import type { CroSuggestion } from "@/lib/cro/suggestions";

export type CroRecommendationStatus = "pending" | "dismissed" | "applied";

export type CroRecommendation = CroSuggestion & {
  id: string;
  status: CroRecommendationStatus;
};

export type CroRecommendationsState = {
  lastRunAt: string;
  score: number;
  suggestions: CroRecommendation[];
};

function safeStr(v: unknown): string {
  if (v == null) return "";
  return (typeof v === "string" ? v : String(v)).trim();
}

function newCroRecommendationId(): string {
  return `cro_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Parse meta.croRecommendations from body.meta. Safe for missing or invalid data.
 */
export function parseCroRecommendationsFromMeta(meta: unknown): CroRecommendationsState | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const root = meta as Record<string, unknown>;
  const rec = root.croRecommendations;
  if (!rec || typeof rec !== "object" || Array.isArray(rec)) return null;
  const r = rec as Record<string, unknown>;
  const lastRunAt = typeof r.lastRunAt === "string" ? r.lastRunAt : "";
  const score = typeof r.score === "number" ? Math.max(0, Math.min(100, r.score)) : 0;
  const arr = Array.isArray(r.suggestions) ? r.suggestions : [];
  const suggestions: CroRecommendation[] = arr
    .filter((s): s is Record<string, unknown> => s != null && typeof s === "object" && !Array.isArray(s))
    .map((s) => {
      const id = typeof s.id === "string" ? s.id : newCroRecommendationId();
      const status = s.status === "dismissed" ? "dismissed" : s.status === "applied" ? "applied" : "pending";
      return {
        id,
        type: (typeof s.type === "string" ? s.type : "missing_cta") as CroSuggestion["type"],
        category: (typeof s.category === "string" ? s.category : "messaging") as CroSuggestion["category"],
        target: s.target === "block" ? "block" : "page",
        targetBlockId: typeof s.targetBlockId === "string" ? s.targetBlockId : "",
        targetBlockIndex: typeof s.targetBlockIndex === "number" && s.targetBlockIndex >= 0 ? s.targetBlockIndex : undefined,
        label: typeof s.label === "string" ? s.label : "",
        before: typeof s.before === "string" ? s.before : "",
        recommendedChange: typeof s.recommendedChange === "string" ? s.recommendedChange : "",
        rationale: typeof s.rationale === "string" ? s.rationale : "",
        priority: (s.priority === "high" || s.priority === "low" ? s.priority : "medium") as CroSuggestion["priority"],
        severity: (s.severity === "error" || s.severity === "warn" || s.severity === "info" ? s.severity : "warn") as CroSuggestion["severity"],
        status,
      };
    });
  return { lastRunAt, score, suggestions };
}

/**
 * Merge fresh CRO result into meta; preserve existing dismissed status by matching type + targetBlockId.
 */
export function mergeCroRecommendationsIntoMeta(
  meta: Record<string, unknown>,
  result: { score: number; suggestions: CroSuggestion[] },
  existingState: CroRecommendationsState | null
): Record<string, unknown> {
  const statusByKey = new Map<string, CroRecommendationStatus>();
  const idByKey = new Map<string, string>();
  if (existingState?.suggestions) {
    for (const s of existingState.suggestions) {
      const key = `${s.type}:${s.target}:${s.targetBlockId}`;
      if (s.status === "dismissed" || s.status === "applied") statusByKey.set(key, s.status);
      idByKey.set(key, s.id);
    }
  }
  const suggestions: CroRecommendation[] = result.suggestions.map((s) => {
    const key = `${s.type}:${s.target}:${s.targetBlockId}`;
    const status = statusByKey.get(key) ?? "pending";
    const id = idByKey.get(key) ?? newCroRecommendationId();
    return {
      ...s,
      id,
      status,
    };
  });
  const next = { ...meta };
  const prev = next.croRecommendations != null && typeof next.croRecommendations === "object" && !Array.isArray(next.croRecommendations)
    ? (next.croRecommendations as Record<string, unknown>)
    : {};
  next.croRecommendations = {
    ...prev,
    lastRunAt: new Date().toISOString(),
    score: result.score,
    suggestions,
  };
  return next;
}

/**
 * Mark a CRO recommendation as dismissed. Reject safety: only updates status in meta.croRecommendations;
 * no content change. Body, blocks, and meta.cro (trustSignals, etc.) are never touched.
 */
export function dismissCroSuggestionInMeta(
  meta: Record<string, unknown>,
  rec: { id: string }
): Record<string, unknown> {
  const next = { ...meta };
  const recState = next.croRecommendations as { suggestions?: CroRecommendation[] } | undefined;
  if (recState != null && typeof recState === "object" && Array.isArray(recState.suggestions)) {
    next.croRecommendations = {
      ...recState,
      suggestions: recState.suggestions.map((s) =>
        s.id === rec.id ? { ...s, status: "dismissed" as const } : s
      ),
    };
  }
  return next;
}
