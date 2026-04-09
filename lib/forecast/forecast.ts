import type { SalesPoint } from "@/lib/forecast/data";

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

export type UnitsForecastResult = {
  forecastPerDay: number;
  confidence: number;
};

export function forecastUnits(points: SalesPoint[], lookback = 7): UnitsForecastResult {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const tail = sorted.slice(-lookback);
  const base = avg(tail.map((p) => p.units));
  return {
    forecastPerDay: Math.max(0, base),
    confidence: tail.length >= lookback ? 0.7 : 0.4,
  };
}
