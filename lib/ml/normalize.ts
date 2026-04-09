import type { MetricRow } from "./dataset";

export type NormStats = { min: number; max: number };

export type MetricNormStats = {
  conversion: NormStats;
  traffic: NormStats;
  revenue: NormStats;
  churn: NormStats;
};

function safeRange(min: number, max: number): number {
  const d = max - min;
  return d === 0 ? 1 : d;
}

/**
 * Min–max normalize a scalar series (deterministic).
 */
export function normalizeSeries(series: number[]): { normalized: number[]; min: number; max: number } {
  if (!series.length) {
    return { normalized: [], min: 0, max: 1 };
  }
  const min = Math.min(...series);
  const max = Math.max(...series);
  const denom = safeRange(min, max);
  return {
    normalized: series.map((v) => (v - min) / denom),
    min,
    max,
  };
}

function normValue(v: number, stats: NormStats): number {
  return (v - stats.min) / safeRange(stats.min, stats.max);
}

function denormValue(v: number, stats: NormStats): number {
  return v * safeRange(stats.min, stats.max) + stats.min;
}

export function computeMetricNormStats(rows: MetricRow[]): MetricNormStats {
  const c = rows.map((r) => r.conversion);
  const t = rows.map((r) => r.traffic);
  const rev = rows.map((r) => r.revenue);
  const ch = rows.map((r) => r.churn);
  const nc = normalizeSeries(c);
  const nt = normalizeSeries(t);
  const nrev = normalizeSeries(rev);
  const nch = normalizeSeries(ch);
  return {
    conversion: { min: nc.min, max: nc.max },
    traffic: { min: nt.min, max: nt.max },
    revenue: { min: nrev.min, max: nrev.max },
    churn: { min: nch.min, max: nch.max },
  };
}

export function normalizeMetricRow(r: MetricRow, stats: MetricNormStats): MetricRow {
  return {
    ts: r.ts,
    conversion: normValue(r.conversion, stats.conversion),
    traffic: normValue(r.traffic, stats.traffic),
    revenue: normValue(r.revenue, stats.revenue),
    churn: normValue(r.churn, stats.churn),
  };
}

export function denormConversion(norm: number, stats: MetricNormStats): number {
  return denormValue(norm, stats.conversion);
}
