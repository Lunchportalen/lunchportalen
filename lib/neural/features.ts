export type TemporalFeatures = {
  avgDelta: number;
  volatility: number;
};

type SeqEntry = { conversionRate?: number; ts?: number };

/**
 * Last-5 conversion deltas — mean change and spread (explainable “temporal” signal).
 */
export function extractTemporalFeatures(seq: SeqEntry[]): TemporalFeatures | null {
  if (seq.length < 5) return null;

  const last = seq.slice(-5);
  const deltas: number[] = [];

  for (let i = 1; i < last.length; i++) {
    const a = Number(last[i]?.conversionRate ?? 0);
    const b = Number(last[i - 1]?.conversionRate ?? 0);
    deltas.push(a - b);
  }

  if (deltas.length === 0) return null;

  const avgDelta = deltas.reduce((x, y) => x + y, 0) / deltas.length;
  const volatility = Math.max(...deltas) - Math.min(...deltas);

  return { avgDelta, volatility };
}
