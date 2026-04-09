export type CeoStrategyInput = {
  revenue?: number;
  forecast?: number;
};

/** Strategiske forslag basert på snapshot (kun tekst — ingen mutasjoner). */
export function getStrategy(data: CeoStrategyInput): string[] {
  const strategies: string[] = [];
  const revenue = typeof data.revenue === "number" ? data.revenue : 0;
  const forecast = typeof data.forecast === "number" ? data.forecast : 0;

  if (forecast < 20000) {
    strategies.push("Øk volum på content");
  }
  if (revenue > 50000) {
    strategies.push("Fokusér på skalering");
  }
  return strategies;
}
