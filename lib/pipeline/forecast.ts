export type ForecastResult = {
  total: number;
  weighted: number;
  confidence: number;
};

/**
 * Deterministisk vektet prognose fra rader med `value` og `probability` (0–1).
 */
export function computeForecast(
  rows: Array<{ value?: unknown; probability?: unknown }> | null | undefined,
): ForecastResult {
  const list = Array.isArray(rows) ? rows : [];
  let weighted = 0;
  let total = 0;

  for (const r of list) {
    const rawV = r.value ?? 0;
    const rawP = r.probability ?? 0;
    const value = typeof rawV === "number" && Number.isFinite(rawV) ? rawV : Number(rawV) || 0;
    const prob = typeof rawP === "number" && Number.isFinite(rawP) ? rawP : Number(rawP) || 0;
    total += value;
    weighted += value * prob;
  }

  return {
    total,
    weighted,
    confidence: total > 0 ? Math.round((weighted / total) * 100) : 0,
  };
}
