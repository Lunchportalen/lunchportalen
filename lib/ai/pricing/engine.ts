import "server-only";

export type PricingSuggestionType = "increase_price" | "decrease_price" | "bundle";

export type PricingSuggestion = {
  type: PricingSuggestionType;
  confidence: number;
  impact: number;
  risk: number;
  explain: string;
};

export type PricingEngineInput = {
  usageLevel?: number;
  conversionRate?: number;
  churnRate?: number;
  competitorBenchmarkDelta?: number | null;
};

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Suggestions only — never mutates prices or billing. Requires human validation.
 */
export function suggestPricingAdjustments(input: PricingEngineInput): PricingSuggestion[] {
  const conv = clamp01(input.conversionRate ?? 0);
  const churn = clamp01(input.churnRate ?? 0);
  const usage = Math.max(0, input.usageLevel ?? 0);
  const bench = input.competitorBenchmarkDelta;

  const out: PricingSuggestion[] = [];

  if (churn > 0.12 && conv < 0.15) {
    out.push({
      type: "bundle",
      confidence: 0.55,
      impact: 0.08,
      risk: 0.35,
      explain:
        "Høy churn og lav konvertering — vurder verdi-pakke eller tydeligere inkluderte tjenester (ikke automatisk prisendring).",
    });
  }

  if (conv > 0.22 && churn < 0.06 && usage > 0.4) {
    out.push({
      type: "increase_price",
      confidence: 0.42,
      impact: 0.06,
      risk: 0.55,
      explain:
        "Sterk konvertering og lav churn — hypotese om prisrom; krever marked/konkurranseanalyse før endring.",
    });
  }

  if (typeof bench === "number" && bench < -0.05) {
    out.push({
      type: "decrease_price",
      confidence: 0.38,
      impact: 0.04,
      risk: 0.6,
      explain: "Signal om at benchmark ligger under — kun som hypotese; valider mot kost og avtaler.",
    });
  }

  if (out.length === 0) {
    out.push({
      type: "bundle",
      confidence: 0.35,
      impact: 0.03,
      risk: 0.2,
      explain: "Begrenset datagrunnlag — behold eksisterende prisstruktur til mer telemetri finnes.",
    });
  }

  return out.slice(0, 5);
}
