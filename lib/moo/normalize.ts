import type { MooNormalized, MooRawMetrics } from "@/lib/moo/types";

const DEFAULT_REV_CAP = 10_000;
const DEFAULT_DWELL_CAP_SEC = 120;

/**
 * Maps raw metrics to [0,1] for weighted scoring (deterministic caps).
 */
export function normalize(
  m: MooRawMetrics,
  opts?: { revenueCap?: number; dwellCapSec?: number },
): MooNormalized {
  const revenueCap = typeof opts?.revenueCap === "number" && opts.revenueCap > 0 ? opts.revenueCap : DEFAULT_REV_CAP;
  const dwellCapSec =
    typeof opts?.dwellCapSec === "number" && opts.dwellCapSec > 0 ? opts.dwellCapSec : DEFAULT_DWELL_CAP_SEC;

  return {
    revenue: Math.min(Math.max(m.revenue, 0) / revenueCap, 1),
    retention: Math.min(Math.max(m.retention, 0), 1),
    dwell: Math.min(Math.max(m.dwellTime, 0) / dwellCapSec, 1),
  };
}
