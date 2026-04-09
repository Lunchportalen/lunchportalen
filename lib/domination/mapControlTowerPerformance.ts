/**
 * Mapper Control Tower-snapshot til {@link OwnPerformanceSignals} — kun eksplisitte, målbare felt.
 */
import type { ControlTowerData } from "@/lib/controlTower/types";
import type { OwnPerformanceSignals } from "@/lib/domination/marketGaps";

export function mapControlTowerToPerformance(t: ControlTowerData): OwnPerformanceSignals {
  const out: OwnPerformanceSignals = {};
  const cdp = t.predictive.basis.conversionDropPercent;
  if (cdp != null && cdp > 15) {
    out.funnelDropRate = Math.min(0.95, cdp / 100);
  }
  return out;
}
