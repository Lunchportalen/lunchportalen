/**
 * Delte typer for deterministisk prognose (ingen ML, ingen syntetikk).
 */

export type PredictiveDailyPoint = {
  date: string;
  total: number;
  aiAttributed: number;
  orderCount: number;
  aiOrderCount: number;
};

export type PredictiveProductRollup = { id: string; revenue: number };
export type PredictivePostRollup = { id: string; revenue: number };

/** Rå innsamlet grunnlag — forklarbart og reproduserbart. */
export type PredictiveCollected = {
  dailyTotals: PredictiveDailyPoint[];
  /** Daglig omsetning (samme rekkefølge som timestamps). */
  revenue: number[];
  products: PredictiveProductRollup[];
  posts: PredictivePostRollup[];
  timestamps: string[];
  collectedAt: string;
  dataSource: "orders" | "unavailable";
  seriesTruncated: boolean;
};
