import "server-only";

export type ConversionOptimizationAction = {
  action: "improve_landing" | "improve_content" | "run_ab_test";
  priority: number;
  confidence: number;
  explain: string;
};

export type ConversionEngineInput = {
  pageViews24h?: number;
  ctaClicks24h?: number;
  draftPages?: number;
  runningExperiments?: number;
};

/**
 * Recommendation-only conversion plan — no auto CMS writes.
 */
export function optimizeConversion(input: ConversionEngineInput): ConversionOptimizationAction[] {
  const pv = Math.max(0, Number(input.pageViews24h ?? 0));
  const cta = Math.max(0, Number(input.ctaClicks24h ?? 0));
  const ctr = pv > 0 ? cta / pv : 0;
  const drafts = Math.max(0, Number(input.draftPages ?? 0));
  const exp = Math.max(0, Number(input.runningExperiments ?? 0));

  const out: ConversionOptimizationAction[] = [];

  if (pv > 60 && ctr < 0.015) {
    out.push({
      action: "improve_landing",
      priority: 90,
      confidence: 0.66,
      explain: `Lav CTA-rate (${(ctr * 100).toFixed(2)} %) ved ${pv} visninger — forbedre over-the-fold og primær CTA.`,
    });
  }

  if (drafts > 0) {
    out.push({
      action: "improve_content",
      priority: 82,
      confidence: 0.62,
      explain: `${drafts} kladd(er) — fullfør kvalitetssikret innhold før trafikkpush.`,
    });
  }

  if (exp === 0 && pv > 120) {
    out.push({
      action: "run_ab_test",
      priority: 74,
      confidence: 0.58,
      explain: "Trafikk uten aktivt eksperiment — kjør kontrollert A/B på én nøkkelflate.",
    });
  }

  if (out.length === 0) {
    out.push({
      action: "improve_content",
      priority: 50,
      confidence: 0.45,
      explain: "Begrenset signal — vedlikehold kontinuerlig CRO-innsikt og måling.",
    });
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, 5);
}
