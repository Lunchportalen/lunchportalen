/**
 * Aggregerer pipeline-rader uten å forutsette faste kolonnenavn (fail-closed, deterministisk).
 */

export type PipelineMetrics = {
  totalValue: number;
  weightedValue: number;
  dealCount: number;
  avgDealSize: number;
};

function toFiniteNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/** Normaliserer sannsynlighet til [0, 1]; støtter 0–1 eller prosent 1–100 i meta. */
function normalizeProbability(raw: number): number {
  if (!Number.isFinite(raw) || raw < 0) return 0;
  if (raw <= 1) return raw;
  if (raw <= 100) return raw / 100;
  return 1;
}

function readRowValue(r: Record<string, unknown>): number {
  const v = r.value ?? r.amount ?? r.deal_value ?? r.value_estimate;
  return toFiniteNumber(v);
}

function readProbability(r: Record<string, unknown>): number {
  const direct = r.probability ?? r.win_probability;
  if (direct !== undefined && direct !== null) {
    return normalizeProbability(toFiniteNumber(direct));
  }
  const meta = r.meta;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const m = meta as Record<string, unknown>;
    const mp = m.probability ?? m.win_probability;
    if (mp !== undefined && mp !== null) {
      return normalizeProbability(toFiniteNumber(mp));
    }
  }
  return 0;
}

export function computePipelineMetrics(rows: Record<string, unknown>[] | null | undefined): PipelineMetrics {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) {
    return {
      totalValue: 0,
      weightedValue: 0,
      dealCount: 0,
      avgDealSize: 0,
    };
  }

  let totalValue = 0;
  let weightedValue = 0;

  for (const r of list) {
    const value = readRowValue(r);
    const probability = readProbability(r);
    totalValue += value;
    weightedValue += value * probability;
  }

  const dealCount = list.length;
  return {
    totalValue,
    weightedValue,
    dealCount,
    avgDealSize: dealCount > 0 ? totalValue / dealCount : 0,
  };
}
