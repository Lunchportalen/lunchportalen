/**
 * Feedback analysis AI capability: analyzeUserFeedback.
 * Analyzes user feedback (comments, ratings, themes) and returns sentiment summary,
 * themes, priority issues, and recommendations. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "analyzeUserFeedback";

const analyzeUserFeedbackCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Analyzes user feedback from comments, ratings, and themes. Returns sentiment summary, theme breakdown, priority issues, and recommendations. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "User feedback analysis input",
    properties: {
      feedback: {
        type: "array",
        description: "Feedback items to analyze",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            text: { type: "string", description: "Comment or summary" },
            rating: { type: "number", description: "1-5 or 0-10" },
            sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
            source: { type: "string", description: "e.g. survey, support, nps" },
            category: { type: "string", description: "Optional pre-assigned category" },
            createdAt: { type: "string" },
          },
        },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["feedback"],
  },
  outputSchema: {
    type: "object",
    description: "Feedback analysis result",
    required: ["sentimentSummary", "themes", "priorityIssues", "recommendations", "summary", "generatedAt"],
    properties: {
      sentimentSummary: {
        type: "object",
        required: ["overall", "score", "counts"],
        properties: {
          overall: { type: "string", enum: ["positive", "neutral", "negative", "mixed"] },
          score: { type: "number", description: "0-100" },
          counts: {
            type: "object",
            properties: {
              positive: { type: "number" },
              neutral: { type: "number" },
              negative: { type: "number" },
            },
          },
        },
      },
      themes: {
        type: "array",
        items: {
          type: "object",
          required: ["theme", "count", "sentiment", "category"],
          properties: {
            theme: { type: "string" },
            count: { type: "number" },
            sentiment: { type: "string" },
            category: { type: "string" },
          },
        },
      },
      priorityIssues: { type: "array", items: { type: "object", properties: { issue: { type: "string" }, count: { type: "number" }, severity: { type: "string" } } } },
      recommendations: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is analysis only; no feedback or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(analyzeUserFeedbackCapability);

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const THEME_KEYWORDS: Record<string, string[]> = {
  usability: ["easy", "simple", "confusing", "hard", "ux", "mobile", "speed", "slow", "intuitive"],
  support: ["support", "help", "response", "answer", "wait"],
  pricing: ["price", "cost", "expensive", "value", "pay"],
  features: ["missing", "want", "need", "would like", "feature", "function"],
  reliability: ["bug", "error", "crash", "broken", "down", "reliable"],
};

function inferCategory(text: string): string {
  const t = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (keywords.some((k) => t.includes(k))) return cat;
  }
  return "other";
}

function inferSentimentFromRating(rating: number): "positive" | "neutral" | "negative" {
  if (rating >= 4) return "positive";
  if (rating <= 2) return "negative";
  return "neutral";
}

export type FeedbackItemInput = {
  id?: string | null;
  text?: string | null;
  rating?: number | null;
  sentiment?: string | null;
  source?: string | null;
  category?: string | null;
  createdAt?: string | null;
};

export type AnalyzeUserFeedbackInput = {
  feedback: FeedbackItemInput[];
  locale?: "nb" | "en" | null;
};

export type SentimentSummary = {
  overall: "positive" | "neutral" | "negative" | "mixed";
  score: number;
  counts: { positive: number; neutral: number; negative: number };
};

export type ThemeSummary = {
  theme: string;
  count: number;
  sentiment: string;
  category: string;
};

export type PriorityIssue = {
  issue: string;
  count: number;
  severity: "high" | "medium" | "low";
};

export type AnalyzeUserFeedbackOutput = {
  sentimentSummary: SentimentSummary;
  themes: ThemeSummary[];
  priorityIssues: PriorityIssue[];
  recommendations: string[];
  summary: string;
  generatedAt: string;
};

/**
 * Analyzes user feedback and returns sentiment, themes, and recommendations. Deterministic; no external calls.
 */
export function analyzeUserFeedback(input: AnalyzeUserFeedbackInput): AnalyzeUserFeedbackOutput {
  const isEn = input.locale === "en";
  const items = Array.isArray(input.feedback) ? input.feedback.filter((f) => f && typeof f === "object") : [];

  const counts = { positive: 0, neutral: 0, negative: 0 };
  const themeCounts = new Map<string, { count: number; sentiment: string; category: string }>();

  for (const f of items) {
    let sentiment = safeStr(f.sentiment);
    if (!sentiment && typeof f.rating === "number") {
      sentiment = inferSentimentFromRating(safeNum(f.rating));
    }
    if (!sentiment) sentiment = "neutral";

    if (sentiment === "positive") counts.positive++;
    else if (sentiment === "negative") counts.negative++;
    else counts.neutral++;

    const text = safeStr(f.text);
    const category = safeStr(f.category) || (text ? inferCategory(text) : "other");
    const theme = text ? (text.length > 60 ? text.slice(0, 57) + "…" : text) : category;

    const key = `${theme}|${category}`;
    const existing = themeCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      themeCounts.set(key, { count: 1, sentiment, category });
    }
  }

  const total = items.length;
  const score = total > 0
    ? Math.max(0, Math.min(100, Math.round(50 + (counts.positive - counts.negative) / total * 50)))
    : 50;
  const overall: SentimentSummary["overall"] =
    counts.negative > total * 0.4 ? "negative" : counts.positive > total * 0.5 ? "positive" : counts.positive > 0 && counts.negative > 0 ? "mixed" : "neutral";

  const themes: ThemeSummary[] = [...themeCounts.entries()]
    .map(([key, v]) => {
      const [theme] = key.split("|");
      return { theme: theme || "other", count: v.count, sentiment: v.sentiment, category: v.category };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const priorityIssues: PriorityIssue[] = themes
    .filter((t) => t.sentiment === "negative" && t.count >= 1)
    .map((t): PriorityIssue => ({
      issue: t.theme,
      count: t.count,
      severity: t.count >= 3 ? "high" : t.count >= 2 ? "medium" : "low",
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const recommendations: string[] = [];
  if (counts.negative > total * 0.3) {
    recommendations.push(isEn ? "Address negative themes; consider follow-up with affected users." : "Adresser negative temaer; vurder oppfølging med berørte brukere.");
  }
  if (priorityIssues.some((p) => p.severity === "high")) {
    recommendations.push(isEn ? "Prioritize high-severity issues in product or support backlog." : "Prioriter høyalvorlige saker i produkt- eller support-backlog.");
  }
  if (themes.some((t) => t.category === "usability" && t.sentiment === "negative")) {
    recommendations.push(isEn ? "Review usability flows and consider UX improvements." : "Gjennomgå brukervaner og vurder UX-forbedringer.");
  }
  if (themes.some((t) => t.category === "reliability")) {
    recommendations.push(isEn ? "Monitor reliability themes; track bugs and stability." : "Overvåk pålitelighets-temaer; spor feil og stabilitet.");
  }

  const summary = isEn
    ? `Feedback analysis: ${total} item(s). Sentiment ${overall} (score ${score}). ${themes.length} theme(s), ${priorityIssues.length} priority issue(s).`
    : `Tilbakemeldingsanalyse: ${total} element(er). Sentiment ${overall} (score ${score}). ${themes.length} tema(er), ${priorityIssues.length} prioritetssak(er).`;

  return {
    sentimentSummary: { overall, score, counts },
    themes,
    priorityIssues,
    recommendations,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { analyzeUserFeedbackCapability, CAPABILITY_NAME };
