/**
 * Autonomous content planner: planContentCalendar.
 * Produces a weekly content plan from traffic gaps and SEO opportunities.
 * Distributes high-priority items across weeks; deterministic; no LLM.
 */

export type TrafficGap = {
  /** e.g. "2024-Q3" or "summer" or identifier */
  period?: string | null;
  /** Optional metric (e.g. "low traffic", "drop") */
  metric?: string | null;
  /** Suggested topic or focus to address the gap */
  suggestedTopic?: string | null;
  /** Optional priority 1–5 (higher = more urgent) */
  priority?: number | null;
};

export type SeoOpportunity = {
  /** e.g. how_to, listicle, faq, comparison */
  type?: string | null;
  /** Suggested title or headline */
  suggestedTitle: string;
  /** Optional priority 1–5 (higher = more valuable) */
  priority?: number | null;
  /** Optional rationale */
  rationale?: string | null;
};

export type PlanContentCalendarInput = {
  trafficGaps?: TrafficGap[] | null;
  seoOpportunities?: SeoOpportunity[] | null;
  locale?: "nb" | "en" | null;
  /** Number of weeks to plan (default 4) */
  weeks?: number | null;
  /** Optional start date (ISO) for week labels */
  startDate?: string | null;
  /** Max items per week (default 3) */
  maxItemsPerWeek?: number | null;
};

export type CalendarItem = {
  title: string;
  type: string;
  source: "traffic_gap" | "seo_opportunity";
  rationale?: string | null;
  priority: number;
};

export type WeekPlan = {
  weekIndex: number;
  weekLabel: string;
  items: CalendarItem[];
};

export type PlanContentCalendarOutput = {
  weeklyPlan: WeekPlan[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseDate(s: string | undefined | null): Date | null {
  if (!s || typeof s !== "string") return null;
  const d = new Date(s.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function weekLabel(weekIndex: number, startDate: Date | null, locale: "nb" | "en"): string {
  if (!startDate) return locale === "en" ? `Week ${weekIndex + 1}` : `Uke ${weekIndex + 1}`;
  const d = new Date(startDate);
  d.setDate(d.getDate() + weekIndex * 7);
  const mon = d.toISOString().slice(0, 10);
  d.setDate(d.getDate() + 6);
  const sun = d.toISOString().slice(0, 10);
  return locale === "en" ? `Week ${weekIndex + 1} (${mon} – ${sun})` : `Uke ${weekIndex + 1} (${mon} – ${sun})`;
}

/**
 * Plans a weekly content calendar from traffic gaps and SEO opportunities.
 * Merges and prioritizes items, distributes across weeks. Deterministic; no external calls.
 */
export function planContentCalendar(input: PlanContentCalendarInput = {}): PlanContentCalendarOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const numWeeks = Math.min(12, Math.max(1, Math.floor(Number(input.weeks) ?? 4)));
  const maxPerWeek = Math.min(5, Math.max(1, Math.floor(Number(input.maxItemsPerWeek) ?? 3)));
  const startDate = parseDate(input.startDate);

  const gaps = Array.isArray(input.trafficGaps)
    ? input.trafficGaps
        .filter((g): g is TrafficGap => g != null && typeof g === "object")
        .map((g) => ({
          title: safeStr(g.suggestedTopic) || (isEn ? "Content for traffic gap" : "Innhold for trafikk hull"),
          type: "traffic_gap",
          source: "traffic_gap" as const,
          rationale: safeStr(g.metric) || safeStr(g.period) || (isEn ? "Address traffic gap." : "Retting av trafikk hull."),
          priority: Math.max(1, Math.min(5, Math.floor(Number(g.priority) ?? 3))),
        }))
    : [];

  const seo = Array.isArray(input.seoOpportunities)
    ? input.seoOpportunities
        .filter((o): o is SeoOpportunity => o != null && typeof o === "object" && typeof (o as SeoOpportunity).suggestedTitle === "string")
        .map((o) => ({
          title: safeStr(o.suggestedTitle) || (isEn ? "SEO content" : "SEO-innhold"),
          type: safeStr(o.type) || "article",
          source: "seo_opportunity" as const,
          rationale: safeStr(o.rationale) || (isEn ? "SEO opportunity." : "SEO-mulighet."),
          priority: Math.max(1, Math.min(5, Math.floor(Number(o.priority) ?? 3))),
        }))
    : [];

  const merged: CalendarItem[] = [
    ...gaps.map((g) => ({
      title: g.title,
      type: g.type,
      source: g.source,
      rationale: g.rationale,
      priority: g.priority,
    })),
    ...seo.map((s) => ({
      title: s.title,
      type: s.type,
      source: s.source,
      rationale: s.rationale,
      priority: s.priority,
    })),
  ].sort((a, b) => b.priority - a.priority);

  const weeklyPlan: WeekPlan[] = [];
  let idx = 0;
  for (let w = 0; w < numWeeks; w++) {
    const items: CalendarItem[] = [];
    for (let i = 0; i < maxPerWeek && idx < merged.length; i++, idx++) {
      items.push(merged[idx]);
    }
    weeklyPlan.push({
      weekIndex: w,
      weekLabel: weekLabel(w, startDate, locale),
      items,
    });
  }

  const totalItems = weeklyPlan.reduce((sum, week) => sum + week.items.length, 0);
  const summary = isEn
    ? `Weekly content plan: ${numWeeks} week(s), ${totalItems} item(s) from ${gaps.length} traffic gap(s) and ${seo.length} SEO opportunity(ies).`
    : `Ukentlig innholdsplan: ${numWeeks} uke(r), ${totalItems} element(er) fra ${gaps.length} trafikk hull og ${seo.length} SEO-mulighet(er).`;

  return {
    weeklyPlan,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
