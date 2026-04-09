export type MetricSeries = number[];

export type BaselineStats = {
  mean: number;
  std: number;
};

export function computeBaseline(series: MetricSeries): BaselineStats {
  if (!series.length) {
    return { mean: 0, std: 0 };
  }
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  const variance = series.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / series.length;
  const std = Math.sqrt(variance);
  return { mean, std };
}
