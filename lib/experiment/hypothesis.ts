/**
 * Deterministiske hypoteser fra målbare signaler — ingen LLM-beslutning.
 * Brukes til å styre variant-generering (tekst/ sekvens), ikke til å velge vinner.
 */

export type HypothesisKind = "conversion_gap" | "scale_pattern" | "observe";

export type HypothesisResult = {
  type: HypothesisKind;
  hypothesis: string;
};

export type PostMetricsInput = {
  clicks: number;
  orders: number;
  revenue: number;
};

export function buildHypothesis(postMetrics: PostMetricsInput): HypothesisResult {
  const clicks = Number.isFinite(postMetrics.clicks) ? postMetrics.clicks : 0;
  const orders = Number.isFinite(postMetrics.orders) ? postMetrics.orders : 0;
  const revenue = Number.isFinite(postMetrics.revenue) ? postMetrics.revenue : 0;

  if (clicks > 50 && orders === 0) {
    return {
      type: "conversion_gap",
      hypothesis: "CTA eller value proposition er svak",
    };
  }

  if (revenue > 10_000) {
    return {
      type: "scale_pattern",
      hypothesis: "Hook/struktur fungerer — repliker",
    };
  }

  return {
    type: "observe",
    hypothesis: "Ingen tydelig signal",
  };
}
