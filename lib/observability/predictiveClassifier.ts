export type AnomalyLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "NORMAL";

export function classifyAnomaly(score: number): AnomalyLevel {
  if (score > 3) return "CRITICAL";
  if (score > 2) return "HIGH";
  if (score > 1.5) return "MEDIUM";
  return "NORMAL";
}
