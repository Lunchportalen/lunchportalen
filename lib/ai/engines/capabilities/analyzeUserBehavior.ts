/**
 * Real-time behavior analysis capability: analyzeUserBehavior.
 * Analyzes user behavior data (events or aggregated metrics) and returns engagement signals,
 * patterns, anomalies, and segment hints. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "analyzeUserBehavior";

const analyzeUserBehaviorCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Analyzes user behavior from events or aggregated metrics. Returns engagement level, patterns (e.g. bounce, short session), anomaly flags, segment hints, and recommendations. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "User behavior analysis input",
    properties: {
      events: {
        type: "array",
        description: "Optional: raw behavior events (type, timestamp, sessionId, page, duration, metadata)",
        items: {
          type: "object",
          properties: {
            type: { type: "string", description: "e.g. page_view, click, scroll, exit" },
            timestamp: { type: "string", description: "ISO or Unix ms" },
            sessionId: { type: "string" },
            page: { type: "string" },
            duration: { type: "number" },
            metadata: { type: "object" },
          },
        },
      },
      aggregated: {
        type: "object",
        description: "Optional: pre-aggregated metrics for a time window",
        properties: {
          sessionCount: { type: "number" },
          pageViewCount: { type: "number" },
          avgSessionDurationSeconds: { type: "number" },
          bounceRate: { type: "number", description: "0-1 or 0-100" },
          clickCount: { type: "number" },
          avgScrollDepth: { type: "number", description: "0-1 or 0-100" },
          windowMinutes: { type: "number" },
        },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
  },
  outputSchema: {
    type: "object",
    description: "Behavior analysis result",
    required: ["engagementLevel", "patterns", "anomalies", "recommendations", "summary", "generatedAt"],
    properties: {
      engagementLevel: { type: "string", enum: ["low", "medium", "high"] },
      patterns: { type: "array", items: { type: "string" } },
      anomalies: { type: "array", items: { type: "string" } },
      segmentHints: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } },
      metrics: { type: "object", description: "Normalized metrics used for analysis" },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is analysis only; no user data mutation or side effects.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(analyzeUserBehaviorCapability);

const BOUNCE_HIGH = 0.6;
const BOUNCE_LOW = 0.4;
const SCROLL_LOW = 0.3;
const SCROLL_HIGH = 0.6;
const AVG_SESSION_SHORT_SEC = 30;
const AVG_SESSION_LONG_SEC = 180;
const PAGES_PER_SESSION_LOW = 1.2;
const PAGES_PER_SESSION_HIGH = 3;

function norm01(v: number | null | undefined, asPercent = false): number | null {
  if (v == null || typeof v !== "number" || !Number.isFinite(v)) return null;
  if (asPercent && v > 1) return Math.min(1, v / 100);
  return Math.max(0, Math.min(1, v));
}

export type BehaviorEventInput = {
  type?: string | null;
  timestamp?: string | number | null;
  sessionId?: string | null;
  page?: string | null;
  duration?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type AggregatedBehaviorInput = {
  sessionCount?: number | null;
  pageViewCount?: number | null;
  avgSessionDurationSeconds?: number | null;
  bounceRate?: number | null;
  clickCount?: number | null;
  avgScrollDepth?: number | null;
  windowMinutes?: number | null;
};

export type AnalyzeUserBehaviorInput = {
  events?: BehaviorEventInput[] | null;
  aggregated?: AggregatedBehaviorInput | null;
  locale?: "nb" | "en" | null;
};

export type AnalyzeUserBehaviorOutput = {
  engagementLevel: "low" | "medium" | "high";
  patterns: string[];
  anomalies: string[];
  segmentHints: string[];
  recommendations: string[];
  metrics?: Record<string, number>;
  summary: string;
  generatedAt: string;
};

function aggregateFromEvents(events: BehaviorEventInput[]): AggregatedBehaviorInput {
  const sessions = new Set<string>();
  let pageViews = 0;
  let totalDuration = 0;
  let durationCount = 0;
  let exits = 0;
  let clicks = 0;
  const scrollDepths: number[] = [];

  for (const e of events) {
    const sid = e.sessionId ?? e.timestamp;
    if (sid != null) sessions.add(String(sid));
    const t = String(e.type ?? "").toLowerCase();
    if (t === "page_view" || t === "view") pageViews++;
    if (t === "exit" || t === "bounce") exits++;
    if (t === "click") clicks++;
    if (typeof e.duration === "number" && e.duration >= 0) {
      totalDuration += e.duration;
      durationCount++;
    }
    const md = e.metadata && typeof e.metadata === "object" ? e.metadata : {};
    const sd = (md as { scrollDepth?: number }).scrollDepth;
    if (typeof sd === "number") scrollDepths.push(sd > 1 ? sd / 100 : sd);
  }

  const sessionCount = sessions.size || 1;
  const avgSessionDurationSeconds = durationCount > 0 ? totalDuration / durationCount : 0;
  const bounceRate = pageViews > 0 ? Math.min(1, exits / pageViews) : 0;
  const avgScrollDepth = scrollDepths.length > 0
    ? scrollDepths.reduce((a, b) => a + b, 0) / scrollDepths.length
    : null;

  return {
    sessionCount,
    pageViewCount: pageViews || sessionCount,
    avgSessionDurationSeconds,
    bounceRate,
    clickCount: clicks,
    avgScrollDepth,
    windowMinutes: null,
  };
}

/**
 * Analyzes behavior from events or aggregated metrics. Deterministic; no external calls.
 */
export function analyzeUserBehavior(input: AnalyzeUserBehaviorInput): AnalyzeUserBehaviorOutput {
  const isEn = input.locale === "en";
  let agg: AggregatedBehaviorInput = input.aggregated ?? {};

  if (Array.isArray(input.events) && input.events.length > 0) {
    agg = aggregateFromEvents(input.events);
  }

  const sessionCount = typeof agg.sessionCount === "number" ? agg.sessionCount : 0;
  const pageViewCount = typeof agg.pageViewCount === "number" ? agg.pageViewCount : 0;
  const avgDurationSec = typeof agg.avgSessionDurationSeconds === "number" ? agg.avgSessionDurationSeconds : 0;
  const bounceRate = norm01(agg.bounceRate, true) ?? 0.5;
  const clickCount = typeof agg.clickCount === "number" ? agg.clickCount : 0;
  const avgScroll = norm01(agg.avgScrollDepth, true) ?? 0.5;

  const pagesPerSession = sessionCount > 0 ? pageViewCount / sessionCount : 1;
  const clickRate = pageViewCount > 0 ? clickCount / pageViewCount : 0;

  const patterns: string[] = [];
  const anomalies: string[] = [];
  const segmentHints: string[] = [];
  const recommendations: string[] = [];

  if (bounceRate >= BOUNCE_HIGH) {
    patterns.push(isEn ? "high_bounce_rate" : "høy_avvisningsrate");
    recommendations.push(isEn ? "Review landing relevance and first-screen clarity." : "Vurder landingssidens relevans og tydelighet i første skjerm.");
  } else if (bounceRate <= BOUNCE_LOW) {
    patterns.push(isEn ? "low_bounce_rate" : "lav_avvisningsrate");
  }

  if (avgScroll < SCROLL_LOW && avgScroll !== null) {
    patterns.push(isEn ? "shallow_scroll" : "lav_scroll");
    recommendations.push(isEn ? "Consider stronger above-fold engagement or clearer content hierarchy." : "Vurder sterkere engasjement over fold eller tydeligere innholdsstruktur.");
  } else if (avgScroll >= SCROLL_HIGH) {
    patterns.push(isEn ? "deep_scroll" : "dyp_scroll");
  }

  if (avgDurationSec > 0 && avgDurationSec < AVG_SESSION_SHORT_SEC) {
    patterns.push(isEn ? "short_sessions" : "korte_økter");
    segmentHints.push(isEn ? "Quick scanners or high exit intent" : "Raskt skannere eller høy avslutningsintensjon");
  } else if (avgDurationSec >= AVG_SESSION_LONG_SEC) {
    patterns.push(isEn ? "long_sessions" : "lange_økter");
    segmentHints.push(isEn ? "Engaged readers or multi-step task" : "Engasjerte lesere eller flertrinnsoppgave");
  }

  if (pagesPerSession < PAGES_PER_SESSION_LOW && sessionCount > 0) {
    patterns.push(isEn ? "single_page_dominant" : "enside_dominerende");
  } else if (pagesPerSession >= PAGES_PER_SESSION_HIGH) {
    patterns.push(isEn ? "multi_page_exploration" : "flerside_utforsking");
  }

  if (clickRate < 0.02 && pageViewCount > 10) {
    patterns.push(isEn ? "low_click_engagement" : "lav_klikk_engasjement");
    recommendations.push(isEn ? "Consider more visible or relevant CTAs." : "Vurder mer synlige eller relevante CTAs.");
  }

  let engagementLevel: "low" | "medium" | "high" = "medium";
  const negativeSignals = (bounceRate >= BOUNCE_HIGH ? 1 : 0) + (avgScroll < SCROLL_LOW ? 1 : 0) + (avgDurationSec > 0 && avgDurationSec < AVG_SESSION_SHORT_SEC ? 1 : 0);
  const positiveSignals = (bounceRate <= BOUNCE_LOW ? 1 : 0) + (avgScroll >= SCROLL_HIGH ? 1 : 0) + (avgDurationSec >= AVG_SESSION_LONG_SEC ? 1 : 0);
  if (negativeSignals >= 2) engagementLevel = "low";
  else if (positiveSignals >= 2) engagementLevel = "high";

  const metrics: Record<string, number> = {
    bounceRate,
    avgScrollDepth: avgScroll,
    avgSessionDurationSeconds: avgDurationSec,
    pagesPerSession,
    clickRate,
  };

  const summary = isEn
    ? `Behavior analysis: ${engagementLevel} engagement. ${patterns.length} pattern(s), ${anomalies.length} anomaly(ies). ${recommendations.length} recommendation(s).`
    : `Atferdsanalyse: ${engagementLevel} engasjement. ${patterns.length} mønster(e), ${anomalies.length} avvik. ${recommendations.length} anbefaling(er).`;

  return {
    engagementLevel,
    patterns,
    anomalies,
    segmentHints,
    recommendations,
    metrics,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { analyzeUserBehaviorCapability, CAPABILITY_NAME };
