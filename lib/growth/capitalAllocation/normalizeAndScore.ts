import type {
  CapitalChannelId,
  NormalizedChannelTriple,
  RawMarketChannelMetrics,
} from "@/lib/growth/capitalAllocation/types";
import { CAPITAL_CHANNELS } from "@/lib/growth/capitalAllocation/types";

const W_REV = 0.6;
const W_RET = 0.25;
const W_DWELL = 0.15;

function minMax(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  if (span <= 1e-12) return values.map(() => 0.5);
  return values.map((v) => (v - min) / span);
}

/**
 * Per-market normalization (across channels) then weighted score.
 */
export function normalizeAndScorePerMarket(
  raw: Record<CapitalChannelId, RawMarketChannelMetrics>,
): { normalized: Record<CapitalChannelId, NormalizedChannelTriple>; scores: Record<CapitalChannelId, number> } {
  const chans = [...CAPITAL_CHANNELS];
  const rev = minMax(chans.map((c) => raw[c]!.revenue));
  const ret = minMax(chans.map((c) => raw[c]!.retention_proxy));
  const dwell = minMax(chans.map((c) => raw[c]!.dwell_proxy));

  const normalized = {} as Record<CapitalChannelId, NormalizedChannelTriple>;
  const scores = {} as Record<CapitalChannelId, number>;

  for (let i = 0; i < chans.length; i++) {
    const id = chans[i]!;
    const n: NormalizedChannelTriple = {
      revenue: rev[i] ?? 0,
      retention: ret[i] ?? 0,
      dwell: dwell[i] ?? 0,
    };
    normalized[id] = n;
    scores[id] = W_REV * n.revenue + W_RET * n.retention + W_DWELL * n.dwell;
  }

  return { normalized, scores };
}
