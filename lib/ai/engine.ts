import "server-only";

import { adjustScore } from "@/lib/ai/adaptiveScoring";
import { analyzeCro } from "@/lib/ai/croAnalyzer";
import { loadPatternWeights } from "@/lib/ai/learning";
import { analyzeSeo } from "@/lib/ai/seoAnalyzer";
import type { AiAnalysisEngineResult, AiEditorPanelPrep, AiSuggestionItem, CMSContentInput } from "@/lib/ai/types";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function normalizeContentInput(content: unknown): CMSContentInput {
  if (!isPlainObject(content)) return {};
  return content as CMSContentInput;
}

function buildSuggestions(seo: ReturnType<typeof analyzeSeo>, cro: ReturnType<typeof analyzeCro>): AiSuggestionItem[] {
  const out: AiSuggestionItem[] = [];
  let n = 0;
  const nextId = (prefix: string) => `${prefix}_${++n}`;

  for (const i of seo.issues) {
    out.push({
      id: nextId("seo"),
      source: "seo",
      kind: "issue",
      title: i.code.replace(/_/g, " "),
      detail: i.message,
      applyHint: { domain: "seo", code: i.code },
    });
  }
  for (const t of seo.improvements) {
    out.push({
      id: nextId("seo_imp"),
      source: "seo",
      kind: "improvement",
      title: "SEO-forbedring",
      detail: t,
      applyHint: { domain: "seo", action: "manual_edit" },
    });
  }
  for (const i of cro.issues) {
    out.push({
      id: nextId("cro"),
      source: "cro",
      kind: "issue",
      title: i.code.replace(/_/g, " "),
      detail: i.message,
      applyHint: { domain: "cro", code: i.code },
    });
  }
  for (const t of cro.suggestions) {
    out.push({
      id: nextId("cro_sug"),
      source: "cro",
      kind: "idea",
      title: "CRO-forslag",
      detail: t,
      applyHint: { domain: "cro", action: "manual_edit" },
    });
  }
  return out;
}

function buildEditorPrep(score: number, suggestions: AiSuggestionItem[]): AiEditorPanelPrep {
  const variant = score >= 85 ? "success" : score >= 60 ? "warning" : "danger";
  const label =
    score >= 85 ? "Sterk side" : score >= 60 ? "Bør finpusses" : score >= 40 ? "Trenger arbeid" : "Kritisk gap";
  return {
    scoreBadge: { score, label, variant },
    suggestionList: suggestions.map((s) => ({
      id: s.id,
      primary: s.detail,
      secondary: `${s.source.toUpperCase()} · ${s.kind}`,
      source: s.source,
      applyable: true,
    })),
  };
}

/**
 * SEO + CRO analyzers + bounded adaptive scoring from experiment feedback.
 * Does not persist or mutate CMS; admin applies changes manually.
 */
export async function runAIAnalysis(content: unknown): Promise<AiAnalysisEngineResult> {
  const normalized = normalizeContentInput(content);
  const seo = analyzeSeo(normalized);
  const cro = analyzeCro(normalized);

  const baseScore = Math.max(
    0,
    Math.min(100, Math.round(seo.score * 0.52 + cro.score * 0.48)),
  );

  const patternWeights = await loadPatternWeights();
  const { adjustedScore, adjustments } = adjustScore(baseScore, normalized, patternWeights);

  const learnedInsights = adjustments.map((a) => ({
    patternKey: a.patternKey,
    reason: a.reason,
    basedOn: a.basedOn,
    scoreDelta: Math.round(a.delta * 100) / 100,
  }));

  const suggestions = buildSuggestions(seo, cro);
  const editorPrep = buildEditorPrep(adjustedScore, suggestions);

  return {
    score: adjustedScore,
    baseScore,
    seo,
    cro,
    suggestions,
    editorPrep,
    learnedInsights,
  };
}
