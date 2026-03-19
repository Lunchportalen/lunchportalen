/**
 * AI insight engine: page performance analysis from analytics events.
 * Uses content_analytics_events (page_view, search, cta_click).
 * Deterministic: no LLM; aggregates events and derives insights and recommendations.
 */

export type AnalyticsEventType = "page_view" | "search" | "cta_click";

/** Single row as returned from content_analytics_events (or equivalent). */
export type AnalyticsEvent = {
  page_id?: string | null;
  variant_id?: string | null;
  environment?: string;
  locale?: string;
  event_type: string;
  event_key?: string | null;
  event_value?: string | null;
  created_at?: string;
};

/** Pre-aggregated metrics (e.g. from insights API or aggregateEvents()). */
export type PagePerformanceMetrics = {
  pageViews7d?: number;
  pageViews30d?: number;
  ctaClicks7d?: number;
  ctaClicks30d?: number;
  ctaTop?: Array<{ key: string; count: number }>;
  searchCount7d?: number;
  searchCount30d?: number;
};

export type PagePerformanceInput =
  | { source: "events"; events: AnalyticsEvent[]; since7d: string; since30d: string }
  | { source: "metrics"; metrics: PagePerformanceMetrics };

export type PagePerformanceInsight = {
  id: string;
  type: "metric" | "trend" | "recommendation";
  title: string;
  description: string;
  /** Optional numeric value for sorting or display. */
  value?: number;
};

export type PagePerformanceResult = {
  /** Overall performance score 0–100 (engagement + CTR + data presence). */
  performanceScore: number;
  /** Human-readable insights derived from events/metrics. */
  insights: PagePerformanceInsight[];
  /** Raw metrics used for the analysis. */
  metrics: PagePerformanceMetrics;
  /** Whether input had enough data to compute a meaningful score. */
  hasSufficientData: boolean;
};

function parseIso(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Aggregates raw analytics events into PagePerformanceMetrics.
 * Filters by event_type and time windows (since7d, since30d).
 */
export function aggregateEvents(
  events: AnalyticsEvent[],
  since7d: string,
  since30d: string
): PagePerformanceMetrics {
  const t7 = parseIso(since7d);
  const t30 = parseIso(since30d);
  const metrics: PagePerformanceMetrics = {
    pageViews7d: 0,
    pageViews30d: 0,
    ctaClicks7d: 0,
    ctaClicks30d: 0,
    ctaTop: [],
    searchCount7d: 0,
    searchCount30d: 0,
  };

  const ctaCounts30 = new Map<string, number>();

  for (const e of events) {
    const created = e.created_at ? parseIso(e.created_at) : 0;
    if (created < t30) continue;
    const in7 = created >= t7;

    if (e.event_type === "page_view") {
      metrics.pageViews30d = (metrics.pageViews30d ?? 0) + 1;
      if (in7) metrics.pageViews7d = (metrics.pageViews7d ?? 0) + 1;
    } else if (e.event_type === "cta_click") {
      metrics.ctaClicks30d = (metrics.ctaClicks30d ?? 0) + 1;
      if (in7) metrics.ctaClicks7d = (metrics.ctaClicks7d ?? 0) + 1;
      const key = (e.event_key ?? "").trim() || "(uten nøkkel)";
      ctaCounts30.set(key, (ctaCounts30.get(key) ?? 0) + 1);
    } else if (e.event_type === "search") {
      metrics.searchCount30d = (metrics.searchCount30d ?? 0) + 1;
      if (in7) metrics.searchCount7d = (metrics.searchCount7d ?? 0) + 1;
    }
  }

  metrics.ctaTop = Array.from(ctaCounts30.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return metrics;
}

function safeNum(v: unknown): number | undefined {
  if (typeof v === "number" && !Number.isNaN(v) && v >= 0) return v;
  return undefined;
}

/**
 * Computes CTR (0–1) from clicks and views; returns undefined if no views.
 */
function ctr(clicks: number, views: number): number | undefined {
  if (views <= 0) return undefined;
  return Math.min(1, clicks / views);
}

/**
 * Derives performance score 0–100 from metrics.
 * Weights: data presence, engagement (views), CTR (cta clicks / views).
 */
function computePerformanceScore(metrics: PagePerformanceMetrics): number {
  const views30 = metrics.pageViews30d ?? 0;
  const cta30 = metrics.ctaClicks30d ?? 0;
  const search30 = metrics.searchCount30d ?? 0;

  if (views30 === 0 && cta30 === 0 && search30 === 0) return 0;

  let score = 0;
  if (views30 > 0) {
    const viewScore = Math.min(100, Math.log10(views30 + 1) * 25);
    score += viewScore * 0.5;
  }
  const ctrVal = ctr(cta30, views30);
  if (ctrVal !== undefined) {
    const ctrScore = Math.round(ctrVal * 100);
    score += Math.min(50, ctrScore * 0.5);
  }
  if (search30 > 0) {
    score += Math.min(20, search30 * 2);
  }
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Builds insights and recommendations from metrics.
 */
function buildInsights(metrics: PagePerformanceMetrics): PagePerformanceInsight[] {
  const out: PagePerformanceInsight[] = [];
  const views7 = metrics.pageViews7d ?? 0;
  const views30 = metrics.pageViews30d ?? 0;
  const cta7 = metrics.ctaClicks7d ?? 0;
  const cta30 = metrics.ctaClicks30d ?? 0;
  const search7 = metrics.searchCount7d ?? 0;
  const search30 = metrics.searchCount30d ?? 0;
  const ctaTop = metrics.ctaTop ?? [];

  if (views30 > 0) {
    out.push({
      id: "insight-views-30",
      type: "metric",
      title: "Sidevisninger (30 d)",
      description: `${views30} visninger de siste 30 dagene.`,
      value: views30,
    });
  }
  if (views7 > 0) {
    out.push({
      id: "insight-views-7",
      type: "metric",
      title: "Sidevisninger (7 d)",
      description: `${views7} visninger siste uke.`,
      value: views7,
    });
  }

  if (views30 > 0 && cta30 >= 0) {
    const ctrVal = ctr(cta30, views30);
    if (ctrVal !== undefined) {
      const pct = Math.round(ctrVal * 100);
      out.push({
        id: "insight-ctr",
        type: "metric",
        title: "CTA-klikkrate",
        description: `${cta30} klikk på ${views30} visninger (${pct} % CTR).`,
        value: pct,
      });
      if (pct < 2 && views30 >= 10) {
        out.push({
          id: "rec-ctr-low",
          type: "recommendation",
          title: "Lav CTA-engagement",
          description: "Få klikk i forhold til visninger. Vurder å plassere CTA høyere eller tydeligere.",
        });
      }
    }
  }

  if (ctaTop.length > 0) {
    const top = ctaTop[0];
    out.push({
      id: "insight-cta-top",
      type: "metric",
      title: "Mest brukte CTA",
      description: `«${top.key}»: ${top.count} klikk.`,
      value: top.count,
    });
  }

  if (search30 > 0) {
    out.push({
      id: "insight-search",
      type: "metric",
      title: "Søk (30 d)",
      description: `${search30} søk siste 30 d (${search7} siste 7 d).`,
      value: search30,
    });
  }

  if (views30 === 0 && cta30 === 0) {
    out.push({
      id: "rec-no-data",
      type: "recommendation",
      title: "Ingen visningsdata",
      description: "Det er ingen sidevisninger eller CTA-klikk for denne siden i valgt periode. Sjekk at analytics sendes fra frontend.",
    });
  }

  return out;
}

/**
 * Analyzes page performance from analytics events or pre-aggregated metrics.
 * Use source: "events" when you have raw content_analytics_events;
 * use source: "metrics" when you already have aggregated counts (e.g. from insights API).
 */
export function analyzePagePerformance(input: PagePerformanceInput): PagePerformanceResult {
  let metrics: PagePerformanceMetrics;

  if (input.source === "events") {
    metrics = aggregateEvents(input.events, input.since7d, input.since30d);
  } else {
    const m = input.metrics;
    metrics = {
      pageViews7d: safeNum(m.pageViews7d),
      pageViews30d: safeNum(m.pageViews30d),
      ctaClicks7d: safeNum(m.ctaClicks7d),
      ctaClicks30d: safeNum(m.ctaClicks30d),
      ctaTop: Array.isArray(m.ctaTop) ? m.ctaTop : [],
      searchCount7d: safeNum(m.searchCount7d),
      searchCount30d: safeNum(m.searchCount30d),
    };
  }

  const views30 = metrics.pageViews30d ?? 0;
  const cta30 = metrics.ctaClicks30d ?? 0;
  const search30 = metrics.searchCount30d ?? 0;
  const hasSufficientData = views30 > 0 || cta30 > 0 || search30 > 0;

  const performanceScore = computePerformanceScore(metrics);
  const insights = buildInsights(metrics);

  return {
    performanceScore,
    insights,
    metrics,
    hasSufficientData,
  };
}
