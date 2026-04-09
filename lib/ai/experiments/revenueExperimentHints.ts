import "server-only";

export type RevenueExperimentHint = {
  title: string;
  revenueImpactHypothesis: number;
  guardrails: string[];
  explain: string;
};

export type RevenueHintInput = {
  runningExperiments: number;
  revenueGrowth: number;
  conversionRate: number;
  experimentRevenue7d?: number;
};

/**
 * Auto suggestions for experiments — must still go through normal experiment creation / approval flows.
 */
export function suggestRevenueAwareExperiments(input: RevenueHintInput): RevenueExperimentHint[] {
  const out: RevenueExperimentHint[] = [];
  const guardrails = [
    "Ingen automatisk publisering",
    "Kun én primær KPI per forsøk",
    "Manuell godkjenning før trafikk",
  ];

  if (input.runningExperiments === 0 && input.conversionRate > 0.08) {
    out.push({
      title: "Forside-CTA vs kontroll",
      revenueImpactHypothesis: 0.04,
      guardrails,
      explain: "Konvertering er sunn nok til å lære av A/B uten å destabilisere trakt.",
    });
  }

  if (input.revenueGrowth < 0 && input.runningExperiments < 2) {
    out.push({
      title: "Verdibudskap / prising kommunikasjon",
      revenueImpactHypothesis: 0.03,
      guardrails,
      explain: "Negativ vekstproxy — test tydeligere ROI-formidling, ikke listepris automatisk.",
    });
  }

  if ((input.experimentRevenue7d ?? 0) > 0 && input.conversionRate < 0.1) {
    out.push({
      title: "Konverteringssteg etter eksperimentinntekt",
      revenueImpactHypothesis: 0.05,
      guardrails,
      explain: "Eksperimentinntekt finnes men konvertering er lav — fokuser på checkout/onboarding-steg.",
    });
  }

  if (out.length === 0) {
    out.push({
      title: "Vente på mer telemetri",
      revenueImpactHypothesis: 0,
      guardrails,
      explain: "Ikke nok signaler for prioritering — fortsett måling før nye forsøk foreslås.",
    });
  }

  return out.slice(0, 4);
}
