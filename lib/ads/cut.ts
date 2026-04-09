/**
 * Tap-kutting: pause under break-even, reduksjon ved svak effektivitet.
 */

import { calculateROAS, type RoasInput } from "@/lib/ads/roas";

export type CutLossesResult =
  | { action: "pause" }
  | { action: "reduce"; factor: number }
  | null;

export function cutLosses(campaign: RoasInput): CutLossesResult {
  const roas = calculateROAS(campaign);
  if (roas < 1) {
    return {
      action: "pause",
    };
  }
  if (roas < 1.5) {
    return {
      action: "reduce",
      factor: 0.7,
    };
  }
  return null;
}
