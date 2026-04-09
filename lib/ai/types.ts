import "server-only";

/** Loose CMS page / global content snapshot passed into analysis. */
export type CMSContentInput = Record<string, unknown>;

export type SeoIssue = { code: string; message: string; severity: "low" | "medium" | "high" };

export type SeoAnalysisResult = {
  score: number;
  issues: SeoIssue[];
  improvements: string[];
  /** Raw signals for editor / debugging */
  signals: {
    titleLength: number;
    metaLength: number;
    headingCount: number;
    wordCount: number;
    keywordHints: string[];
  };
};

export type CroIssue = { code: string; message: string; severity: "low" | "medium" | "high" };

export type CroAnalysisResult = {
  score: number;
  issues: CroIssue[];
  suggestions: string[];
  signals: {
    ctaBlockCount: number;
    heroPresent: boolean;
    textBlockCount: number;
    trustSignalsFound: string[];
  };
};

/** Unified suggestion row for lists + future “Apply” wiring (client sends id back). */
export type AiSuggestionItem = {
  id: string;
  source: "seo" | "cro";
  kind: "issue" | "improvement" | "idea";
  title: string;
  detail: string;
  /** Reserved for editor: e.g. block id or patch key — never auto-applied server-side */
  applyHint?: Record<string, unknown>;
};

/** Prepared shapes for an AI side panel (no UI implementation here). */
export type AiEditorPanelPrep = {
  scoreBadge: {
    score: number;
    label: string;
    variant: "success" | "warning" | "danger";
  };
  suggestionList: Array<{
    id: string;
    primary: string;
    secondary?: string;
    source: "seo" | "cro";
    applyable: boolean;
  }>;
};

/** Explainable nudge from aggregated experiments (never auto-applies content). */
export type AiLearnedInsight = {
  patternKey: string;
  reason: string;
  basedOn: ("experiment_data" | "seo_rules" | "cro_rules")[];
  scoreDelta: number;
};

export type AiAnalysisEngineResult = {
  /** Final score after adaptive experiment-derived adjustment (bounded). */
  score: number;
  /** SEO+CRO blend before learning weights. */
  baseScore: number;
  seo: SeoAnalysisResult;
  cro: CroAnalysisResult;
  suggestions: AiSuggestionItem[];
  editorPrep: AiEditorPanelPrep;
  learnedInsights: AiLearnedInsight[];
};

/** Generator block shape — editor can map `type` + `data` to internal blocks. */
export type AiGeneratedBlock = {
  id?: string;
  type: string;
  data?: Record<string, unknown>;
};

export type AiGenerateResult = {
  blocks: AiGeneratedBlock[];
};
