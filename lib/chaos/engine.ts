import "server-only";

/**
 * Deterministisk «tilfeldig» i [0,1) fra stabil streng (ingen Math.random).
 */
function unitFromKey(key: string): number {
  let h = 2166136261;
  const s = String(key ?? "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

/**
 * Simuler feil når CHAOS_MODE=true. Sannsynlighet er deterministisk per nøkkel (f.eks. rid).
 * @param probability 0..1 (1 = alltid feil når chaos er på)
 */
export function shouldFail(probability = 0.1, key = "default"): boolean {
  if (String(process.env.CHAOS_MODE ?? "").trim().toLowerCase() !== "true") {
    return false;
  }
  const p = typeof probability === "number" && Number.isFinite(probability) ? Math.min(1, Math.max(0, probability)) : 0;
  if (p >= 1) return true;
  if (p <= 0) return false;
  return unitFromKey(key) < p;
}
