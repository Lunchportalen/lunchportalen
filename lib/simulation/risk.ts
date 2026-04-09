/**
 * Enkel risikolabel fra simulert resultat (heuristikk).
 */

export type SimulationRiskLevel = "high" | "medium" | "low";

export function assessRisk(simulation: { profit: number }): SimulationRiskLevel {
  const p =
    typeof simulation.profit === "number" && Number.isFinite(simulation.profit) ? simulation.profit : 0;
  if (p < 0) return "high";
  if (p < 1000) return "medium";
  return "low";
}
