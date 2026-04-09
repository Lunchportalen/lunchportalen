import type { SystemDataBundle } from "./collect";
import type { BottleneckIssue } from "./types";

export type ImpactEstimate = {
  impact: number;
  formula: string;
};

/**
 * Enhet: samme valuta som line_total (typisk NOK). Konservative heuristikk — ikke budsjett.
 */
export function estimateImpact(issue: BottleneckIssue, data: SystemDataBundle): ImpactEstimate {
  const totalRevenue = data.totalRevenue;

  if (issue.stage === "lead_to_order") {
    const uplift = 0.15;
    return {
      impact: totalRevenue * uplift,
      formula: `15% av omsetning i vindu (≈${totalRevenue.toFixed(2)}) som teoretisk upside ved å forbedre lead→order; krever salgs-sekvens og oppfølging — ikke auto.`,
    };
  }

  if (issue.stage === "click_to_lead") {
    const uplift = 0.12;
    return {
      impact: totalRevenue * uplift,
      formula: `12% av omsetning i vindu som teoretisk upside ved å forbedre lead-fangst (landing/CTA) — ikke auto.`,
    };
  }

  if (issue.stage === "reliability") {
    const sample = data.logs.length;
    const r = sample > 0 ? data.counts.errorLikeLogs / sample : 0;
    const impact = totalRevenue * Math.min(0.2, r * 0.4);
    return {
      impact,
      formula: `Feilrate i logg-sample ${(r * 100).toFixed(1)}% → modellert tap/kostnad opptil 20% av omsetning, skalert med feilrate.`,
    };
  }

  return { impact: 0, formula: "Ingen definert modell for dette stadiet." };
}
