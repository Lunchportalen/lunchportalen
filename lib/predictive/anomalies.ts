/**
 * Regelbaserte avvik — ingen antatte tall utenfor innkomne felt.
 */

export type AnomalyInput = {
  revenueToday: number;
  /** Prosentpoeng fall i AI-ordreandel (nyere 3 d vs forrige 3 d), null hvis ikke målbart. */
  conversionDropPercent: number | null;
  weekTruncated: boolean;
  seriesTruncated: boolean;
  dataSource: "orders" | "unavailable";
  systemHealth: "ok" | "warning" | "critical";
};

export function detectAnomalies(input: AnomalyInput): string[] {
  const out: string[] = [];

  if (input.dataSource === "unavailable") {
    out.push("Prognose/avvik begrenset: ordredata utilgjengelig.");
    return out;
  }

  if (input.revenueToday === 0) {
    out.push("Ingen registrert omsetning i dag (aktive ordre).");
  }

  if (input.conversionDropPercent != null && input.conversionDropPercent > 30) {
    out.push("AI-attributtert ordreandel faller kraftig siste dager (over 30 prosentpoeng).");
  }

  if (input.weekTruncated || input.seriesTruncated) {
    out.push("Datagrunnlaget er avkappet — tall kan være ufullstendige.");
  }

  if (input.systemHealth === "critical") {
    out.push("Systemhelse kritisk — prioriter stabilitet før vekstgrep.");
  }

  return out;
}
