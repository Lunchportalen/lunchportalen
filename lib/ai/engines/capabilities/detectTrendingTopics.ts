/**
 * Trending-topic detector capability: detectTrendingTopics.
 * Detects rising, declining, or stable topics from a time series of per-topic values
 * (e.g. search volume, mentions, traffic per topic). Compares recent window to previous window.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectTrendingTopics";

const detectTrendingTopicsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Trending-topic detector: from a time series of per-topic values (e.g. topic, period, value), detects rising, declining, or stable topics by comparing recent vs previous window. Returns topic, direction, strength, recentAvg, previousAvg, changePercent, suggestion. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Detect trending topics input",
    properties: {
      timeSeries: {
        type: "array",
        description: "Per-topic values over time: [{ topic, period, value }, ...]. Periods should be time-ordered.",
        items: {
          type: "object",
          required: ["topic", "period", "value"],
          properties: {
            topic: { type: "string" },
            period: { type: "string", description: "e.g. date or week label" },
            value: { type: "number" },
          },
        },
      },
      recentWindow: {
        type: "number",
        description: "Number of most recent periods to use as 'recent' (default: 3)",
      },
      previousWindow: {
        type: "number",
        description: "Number of periods before recent to use as 'previous' (default: 3)",
      },
      minChangePercent: {
        type: "number",
        description: "Min percent change to label as trending/declining (default: 15)",
      },
      locale: { type: "string", description: "Locale (nb | en) for suggestions" },
    },
    required: ["timeSeries"],
  },
  outputSchema: {
    type: "object",
    description: "Trending topics result",
    required: ["topics", "summary", "detectedAt"],
    properties: {
      topics: {
        type: "array",
        items: {
          type: "object",
          required: ["topic", "direction", "strength", "recentAvg", "previousAvg", "changePercent", "suggestion"],
          properties: {
            topic: { type: "string" },
            direction: { type: "string", enum: ["rising", "declining", "stable"] },
            strength: { type: "string", enum: ["high", "medium", "low"] },
            recentAvg: { type: "number" },
            previousAvg: { type: "number" },
            changePercent: { type: "number" },
            suggestion: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      detectedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Detection only; does not mutate any data.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(detectTrendingTopicsCapability);

export type TopicDataPoint = {
  topic: string;
  period: string;
  value: number;
};

export type DetectTrendingTopicsInput = {
  timeSeries: TopicDataPoint[];
  recentWindow?: number | null;
  previousWindow?: number | null;
  minChangePercent?: number | null;
  locale?: "nb" | "en" | null;
};

export type TrendingTopicResult = {
  topic: string;
  direction: "rising" | "declining" | "stable";
  strength: "high" | "medium" | "low";
  recentAvg: number;
  previousAvg: number;
  changePercent: number;
  suggestion: string;
};

export type DetectTrendingTopicsOutput = {
  topics: TrendingTopicResult[];
  summary: string;
  detectedAt: string;
};

const DEFAULT_RECENT_WINDOW = 3;
const DEFAULT_PREVIOUS_WINDOW = 3;
const DEFAULT_MIN_CHANGE_PERCENT = 15;

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Detects trending topics by comparing recent vs previous window averages per topic.
 * Deterministic; no external calls.
 */
export function detectTrendingTopics(input: DetectTrendingTopicsInput): DetectTrendingTopicsOutput {
  const series = Array.isArray(input.timeSeries) ? input.timeSeries : [];
  const recentWindow = Math.max(1, Math.floor(Number(input.recentWindow) ?? DEFAULT_RECENT_WINDOW));
  const previousWindow = Math.max(1, Math.floor(Number(input.previousWindow) ?? DEFAULT_PREVIOUS_WINDOW));
  const minChange = Math.max(0, Number(input.minChangePercent) ?? DEFAULT_MIN_CHANGE_PERCENT);
  const isEn = input.locale === "en";

  const byTopic = new Map<string, { period: string; value: number }[]>();
  for (const row of series) {
    const topic = String(row?.topic ?? "").trim();
    if (!topic) continue;
    const period = String(row?.period ?? "").trim();
    const value = typeof row?.value === "number" ? row.value : Number(row?.value) || 0;
    let list = byTopic.get(topic);
    if (!list) {
      list = [];
      byTopic.set(topic, list);
    }
    list.push({ period, value });
  }

  const topics: TrendingTopicResult[] = [];
  const allPeriods = [...new Set(series.map((r) => String(r?.period ?? "").trim()).filter(Boolean))];
  allPeriods.sort();

  for (const [topic, points] of byTopic) {
    if (points.length < 2) {
      topics.push({
        topic,
        direction: "stable",
        strength: "low",
        recentAvg: points[0]?.value ?? 0,
        previousAvg: 0,
        changePercent: 0,
        suggestion: isEn ? `Not enough data for "${topic}".` : `Ikke nok data for «${topic}».`,
      });
      continue;
    }

    const byPeriod = new Map(points.map((p) => [p.period, p.value]));
    const orderedPeriods = [...new Set(points.map((p) => p.period))].sort();
    const recentPeriods = orderedPeriods.slice(-recentWindow);
    const previousPeriods = orderedPeriods.slice(-recentWindow - previousWindow, -recentWindow);

    const recentValues = recentPeriods.map((p) => byPeriod.get(p) ?? 0).filter((_, i) => recentPeriods[i]);
    const previousValues = previousPeriods.map((p) => byPeriod.get(p) ?? 0).filter((_, i) => previousPeriods[i]);

    const recentAvg = mean(recentValues);
    const previousAvg = previousValues.length > 0 ? mean(previousValues) : recentAvg;

    let changePercent = 0;
    if (previousAvg > 0) {
      changePercent = ((recentAvg - previousAvg) / previousAvg) * 100;
    }

    let direction: "rising" | "declining" | "stable" = "stable";
    let strength: "high" | "medium" | "low" = "low";

    if (changePercent >= minChange) {
      direction = "rising";
      strength = changePercent >= minChange * 2 ? "high" : changePercent >= minChange * 1.5 ? "medium" : "low";
    } else if (changePercent <= -minChange) {
      direction = "declining";
      strength = changePercent <= -minChange * 2 ? "high" : changePercent <= -minChange * 1.5 ? "medium" : "low";
    }

    let suggestion: string;
    const pct = Math.abs(Math.round(changePercent));
    if (direction === "rising") {
      suggestion = isEn
        ? `"${topic}" is trending up (+${pct}%). Consider content or campaigns.`
        : `«${topic}» er stigende (+${pct}%). Vurder innhold eller kampanjer.`;
    } else if (direction === "declining") {
      suggestion = isEn
        ? `"${topic}" is declining (${pct}%). Review relevance or refresh.`
        : `«${topic}» synker (${pct}%). Vurder relevans eller oppdater.`;
    } else {
      suggestion = isEn
        ? `"${topic}" is stable. Keep monitoring.`
        : `«${topic}» er stabilt. Fortsett å overvåke.`;
    }

    topics.push({
      topic,
      direction,
      strength,
      recentAvg,
      previousAvg,
      changePercent,
      suggestion,
    });
  }

  topics.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  const risingCount = topics.filter((t) => t.direction === "rising").length;
  const decliningCount = topics.filter((t) => t.direction === "declining").length;
  const summary = isEn
    ? `${topics.length} topic(s) analyzed. ${risingCount} rising, ${decliningCount} declining.`
    : `${topics.length} emne(r) analysert. ${risingCount} stigende, ${decliningCount} synkende.`;

  return {
    topics,
    summary,
    detectedAt: new Date().toISOString(),
  };
}

export { detectTrendingTopicsCapability, CAPABILITY_NAME };
