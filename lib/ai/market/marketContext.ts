/**
 * Market-aware view for intelligence crons (no writes). Timestamps optional for tests.
 */

export type MarketContext = {
  competitors: string[];
  marketTraffic: number;
  demandSignals: string[];
  priceIndex: number;
  growthRate: number;
  timestamp: number;
};

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function pickNum(input: unknown, key: string): number {
  if (input == null || typeof input !== "object") return 0;
  const v = (input as Record<string, unknown>)[key];
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function buildMarketContext(input: unknown, nowMs: number = Date.now()): MarketContext {
  if (input == null || typeof input !== "object") {
    return {
      competitors: [],
      marketTraffic: 0,
      demandSignals: [],
      priceIndex: 0,
      growthRate: 0,
      timestamp: nowMs,
    };
  }
  const o = input as Record<string, unknown>;
  return {
    competitors: strList(o.competitors),
    marketTraffic: pickNum(o, "marketTraffic"),
    demandSignals: strList(o.demandSignals),
    priceIndex: pickNum(o, "priceIndex"),
    growthRate: pickNum(o, "growthRate"),
    timestamp: nowMs,
  };
}
