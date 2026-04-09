/**
 * Aggregates trends / anomalies / opportunities from the same metric surface as decisions.
 */

import type { DecisionInputData } from "./decisionEngine";

export type InsightsBundle = {
  trends: string[];
  anomalies: string[];
  opportunities: string[];
};

export function generateInsights(data: DecisionInputData): InsightsBundle {
  const trends: string[] = [];
  const anomalies: string[] = [];
  const opportunities: string[] = [];

  const cr = data.conversionRate;
  const traffic = data.traffic;
  const engage = data.engagementScore;
  const rev = data.revenueProxy;
  const seo = data.seoOrganicDelta;
  const wins = data.experimentWinRates ?? [];

  if (typeof traffic === "number") {
    trends.push(
      traffic > 1000
        ? "Trafikknivå: høy — egnet for segmenterte eksperimenter og holdout."
        : "Trafikknivå: moderat — prioriter færre, tydeligere tester.",
    );
  }

  if (typeof cr === "number") {
    trends.push(`Oppdaget konverteringsrate ~${(cr * 100).toFixed(2)} % i inndata (proxy).`);
  }

  if (typeof engage === "number" && engage < 0.4) {
    anomalies.push("Engasjement under forventet terskel — sjekk landingssamsvar med kanal.");
  }

  if (typeof seo === "number" && seo < 0) {
    anomalies.push("Organisk trafikk faller — sammenfall med SERP-endring eller sesong bør verifiseres.");
  }

  if (wins.some((w) => w < 0.5)) {
    anomalies.push("Ett eller flere eksperimentløp uten klar vinner — vurder stoppregler.");
  }

  opportunities.push("Koble growth-SEO API med nye pilar-sider når policy godkjenner innhold.");
  opportunities.push("Bruk design-score og funnel-API som forhåndsjekk før CTA-endringer.");
  opportunities.push("Synkroniser beslutninger med eksisterende experiments-sporing — ingen parallell sannhet.");

  if (typeof rev === "number" && rev > 0) {
    opportunities.push("Omsetningsproxy stiger — dokumenter drivere før skalering av budskap.");
  }

  return { trends, anomalies, opportunities };
}
