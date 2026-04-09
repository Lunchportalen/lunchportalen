import "server-only";

/** Optional performance signals — never persisted here; used for recommendation text only. */
export type PerformanceMetricsInput = {
  views?: number;
  sessions?: number;
  ctr?: number;
  /** 0–1 or 0–100; normalized heuristically */
  conversionRate?: number;
  bounceRate?: number;
  avgScrollDepth?: number;
};

function num(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return v;
}

export function normalizeMetrics(raw: unknown): PerformanceMetricsInput | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  return {
    views: num(o.views),
    sessions: num(o.sessions),
    ctr: num(o.ctr),
    conversionRate: num(o.conversionRate),
    bounceRate: num(o.bounceRate),
    avgScrollDepth: num(o.avgScrollDepth),
  };
}

/**
 * Turn metrics into human recommendations (suggestions only — no writes).
 */
export function metricsToRecommendations(m: PerformanceMetricsInput | undefined): string[] {
  if (!m) return [];
  const out: string[] = [];

  if (m.ctr !== undefined && m.ctr < 0.02) {
    out.push("Lav CTR: test sterkere hero + én tydelig primær-CTA (variant A/B).");
  }
  if (m.bounceRate !== undefined && m.bounceRate > 0.55) {
    out.push("Høy bounce: forkort over-the-fold budskap og legg inn tillitssignal nær toppen.");
  }
  if (m.avgScrollDepth !== undefined && m.avgScrollDepth < 0.35) {
    out.push("Lav scroll-dybde: del opp innhold med mellomtitler og «verdi først».");
  }
  if (m.conversionRate !== undefined) {
    const cr = m.conversionRate > 1 ? m.conversionRate / 100 : m.conversionRate;
    if (cr < 0.02) {
      out.push("Konvertering under forventet: reduser friksjon før skjema/CTA og gjenta budskap.");
    }
  }
  if (m.views !== undefined && m.views > 500 && m.sessions !== undefined && m.sessions < m.views * 0.3) {
    out.push("Mange visninger vs. økter: sjekk at landingssiden matcher annonse/kilde-intensjon.");
  }

  return out.slice(0, 8);
}
