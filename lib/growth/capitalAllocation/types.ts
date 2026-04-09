/**
 * Capital allocation (markets × canonical channels). Pure types — no I/O.
 */

export const CAPITAL_CHANNELS = ["linkedin", "facebook", "email", "retargeting"] as const;
export type CapitalChannelId = (typeof CAPITAL_CHANNELS)[number];

export type ExplorationBand = "low" | "medium" | "high";

export type RawMarketChannelMetrics = {
  revenue: number;
  orders: number;
  sessions: number;
  revenue_per_session: number;
  /** 0..1 proxy: repeat / depth signal (orders vs sessions). */
  retention_proxy: number;
  /** 0..1 proxy: clicks / views. */
  dwell_proxy: number;
};

export type NormalizedChannelTriple = {
  revenue: number;
  retention: number;
  dwell: number;
};

export type MarketSnapshot = {
  revenue: number;
  retention: number;
  dwell: number;
};
