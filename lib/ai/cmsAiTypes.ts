/**
 * CMS AI — types only (importable from client for display shapes if needed).
 * Runtime mutations: none. Apply flows copy JSON into Sanity manually or via explicit publish.
 */

export type CmsAiRunContext = {
  companyId: string;
  userId: string;
};

export type CmsMenuContentInput = {
  mealType?: string | null;
  title: string;
  description?: string | null;
  allergens?: string[] | null;
};

export type CmsMenuContentImproved = {
  title: string;
  description: string;
  allergens: string[];
};

export type CmsMenuGenerated = CmsMenuContentImproved & {
  mealType: string;
};

export type CmsMenuQualityResult = {
  score: number;
  issues: string[];
  /** True when output relied on heuristics only (no provider). */
  heuristicOnly?: boolean;
};

export type CmsWeekVariationSuggestion = {
  days: Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri", string>>;
  notes?: string;
};

export type CmsAiEngineResult<T> =
  | { ok: true; data: T; model?: string; rid?: string }
  | { ok: false; error: string; code?: string };
