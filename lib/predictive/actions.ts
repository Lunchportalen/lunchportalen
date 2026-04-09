/**
 * Forslagsmotor — kun tekstlige anbefalinger, ingen auto-utførelse.
 */

import type { TrendResult } from "@/lib/predictive/trends";

export type ActionContext = {
  trend: TrendResult;
  bestProductId: string | null;
  lowConversion: boolean;
  forecastSufficient: boolean;
  anomaliesNonEmpty: boolean;
};

export function recommendActions(context: ActionContext): string[] {
  const actions: string[] = [];

  if (!context.forecastSufficient) {
    actions.push("Samle flere dagers ordredata før operative grep (prognose deaktivert).");
  }

  if (context.trend.direction === "down") {
    actions.push("Vurder økt synlighet og publiseringsfrekvens for dokumentert topp-innhold.");
  }

  if (context.bestProductId) {
    actions.push(`Promoter og målrett produkt «${context.bestProductId}» (sterkest AI-attributtert omsetning i vindu).`);
  }

  if (context.lowConversion) {
    actions.push("Test ny hook eller bilde på planlagte poster — lav AI-ordreandel mot historikk.");
  }

  if (context.anomaliesNonEmpty) {
    actions.push("Gå gjennom advarsler over før budskap eller budsjett justeres.");
  }

  if (context.trend.direction === "up") {
    actions.push("Oppretthold rytme — trend er opp; unngå unødvendige eksperiment samtidig.");
  }

  return actions;
}
