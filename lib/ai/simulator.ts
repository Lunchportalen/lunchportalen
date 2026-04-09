/**
 * Scenario-simulator — illustrative ranges, ikke garantier.
 */

export type SimulationScenario =
  | "add_cta"
  | "improve_seo"
  | "improve_content"
  | "pricing_tune"
  | "social_post"
  | "generic";

export type SimulationOutcome = {
  expectedImpact: string;
  risk: "low" | "medium" | "high" | "unknown";
  notes: string;
};

export function simulateChange(type: SimulationScenario, _data?: Record<string, unknown>): SimulationOutcome {
  switch (type) {
    case "add_cta":
      return {
        expectedImpact: "Typisk +5–15 % relativ konvertering når CTA manglet (varierer sterkt med kanal).",
        risk: "low",
        notes: "Lav teknisk risiko; må fortsatt kvalitetssikres i redigerer og måles etter publisering.",
      };
    case "improve_seo":
      return {
        expectedImpact: "Ofte +10–30 % organisk trafikk over uker/måneder (avhengig av søkemarked og konkurranse).",
        risk: "medium",
        notes: "Ingen umiddelbar effekt; krever indeksering og korrekt innhold/intent.",
      };
    case "improve_content":
      return {
        expectedImpact: "Bedre tid på side og kvalifisering — ofte støtter konvertering indirekte.",
        risk: "low",
        notes: "Sørg for én tydelig handling per seksjon for å unngå «tekst uten mål».",
      };
    case "pricing_tune":
      return {
        expectedImpact: "Prisendring kan flytte margin eller volum — effekt avhenger av elastisitet og marked.",
        risk: "high",
        notes: "Krever eksplisitt ledelsesbeslutning, kommunikasjon og eventuelt kontraktsjekk. Aldri auto-utfør.",
      };
    case "social_post":
      return {
        expectedImpact: "Ofte +5–20 % reach i kanalen når innlegget er relevant og postes med jevn rytme (varierer).",
        risk: "low",
        notes: "Lav teknisk risiko for standard produktpost; merkesikkerhet og juridisk tekst må fortsatt godkjennes.",
      };
    default:
      return {
        expectedImpact: "Ukjent uten mer kontekst — bruk målrettede data og pilot.",
        risk: "unknown",
        notes: "Velg et konkret scenario eller legg inn tall i markedssignaler før du prioriterer.",
      };
  }
}
