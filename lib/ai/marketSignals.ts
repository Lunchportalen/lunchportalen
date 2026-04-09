/**
 * Markedssignal — deterministisk tolkning av enkle trafikk-/konverteringsindikatorer.
 * Ingen eksterne API-kall; brukes som rådgivning i AI CEO-panelet.
 */

export type MarketSignalLabel = "high_traffic_low_conversion" | "low_visibility" | "stable" | "no_data";

export type MarketSignalResult = {
  label: MarketSignalLabel;
  /** Kort statuslinje for dashboard */
  headline: string;
  /** Forklaring for beslutningstaker */
  detail: string;
};

/**
 * @param traffic - f.eks. økter/visninger per periode (tall du legger inn manuelt i panelet)
 * @param conversions - målhendelser i samme periode
 */
export function detectSignals(input: { traffic: number; conversions: number }): MarketSignalResult {
  const traffic = Math.max(0, Number(input.traffic) || 0);
  const conversions = Math.max(0, Number(input.conversions) || 0);

  if (traffic <= 0 && conversions <= 0) {
    return {
      label: "no_data",
      headline: "Ingen signaldata i panelet",
      detail:
        "Legg inn trafikk og konverteringer for å få en enkel tolkning. Uten tall viser vi ingen skjult antakelse — alt forblir transparent.",
    };
  }

  if (traffic > 1000 && conversions < 10) {
    return {
      label: "high_traffic_low_conversion",
      headline: "Høy trafikk, lav konvertering",
      detail:
        "Mønsteret tyder på at tilbud eller handlingslinje ikke matcher volumet. Vurder CRO (CTA, budskap, tillit) før flere besøk.",
    };
  }

  if (traffic < 200) {
    return {
      label: "low_visibility",
      headline: "Lav synlighet / lite volum",
      detail: "Med lav trafikk bør SEO og distribusjon prioriteres for å få mer datagrunnlag før aggressive prisgrep.",
    };
  }

  return {
    label: "stable",
    headline: "Signalene ser stabile ut",
    detail: "Ingen ekstrem avvik mellom trafikk og konvertering ut fra oppgitte tall — fortsett måling og små, kontrollerte eksperimenter.",
  };
}
