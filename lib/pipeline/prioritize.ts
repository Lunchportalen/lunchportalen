/**
 * Deterministisk prioritering av leads — ingen AI.
 */

export type LeadLike = {
  id: string;
  meta?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export function readSignalsFromMeta(meta: Record<string, unknown> | null | undefined): {
  predicted_probability: number;
  activity_count: number;
  days_since_last_activity: number;
} {
  const m = meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
  const pp = m.predicted_probability;
  const pred = typeof pp === "number" && Number.isFinite(pp) ? pp : 0;

  let activity_count = 0;
  let days_since_last_activity = 0;

  const pe = m.prediction_engine;
  if (pe && typeof pe === "object" && !Array.isArray(pe)) {
    const features = (pe as Record<string, unknown>).features;
    if (features && typeof features === "object" && !Array.isArray(features)) {
      const f = features as Record<string, unknown>;
      if (typeof f.activity_count === "number" && Number.isFinite(f.activity_count)) {
        activity_count = f.activity_count;
      }
      if (typeof f.days_since_last_activity === "number" && Number.isFinite(f.days_since_last_activity)) {
        days_since_last_activity = f.days_since_last_activity;
      }
    }
  }

  if (typeof m.activity_count === "number" && Number.isFinite(m.activity_count)) {
    activity_count = m.activity_count;
  }
  if (typeof m.days_since_last_activity === "number" && Number.isFinite(m.days_since_last_activity)) {
    days_since_last_activity = m.days_since_last_activity;
  }

  return { predicted_probability: pred, activity_count, days_since_last_activity };
}

export type PrioritizedLead = LeadLike & {
  priority_score: number;
};

/**
 * Høyere score = høyere prioritet (sortert synkende).
 */
export function prioritizeDeals(leads: LeadLike[]): PrioritizedLead[] {
  const list = Array.isArray(leads) ? leads : [];

  return list
    .map((l) => {
      const meta =
        l.meta && typeof l.meta === "object" && !Array.isArray(l.meta)
          ? (l.meta as Record<string, unknown>)
          : {};
      const sig = readSignalsFromMeta(meta);

      const score =
        (sig.predicted_probability || 0) +
        (sig.activity_count || 0) * 2 -
        (sig.days_since_last_activity || 0) * 1.5;

      return {
        ...l,
        priority_score: Math.round(score * 100) / 100,
      };
    })
    .sort((a, b) => b.priority_score - a.priority_score);
}
