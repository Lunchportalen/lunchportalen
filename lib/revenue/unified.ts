/**
 * Enhetlig omsetningsentitet — én hendelse per sporbart beløp (kilde-sannhet for motorer).
 */

export type RevenueEventSource = "ai_social" | "ads" | "direct";

export type RevenueEvent = {
  orderId: string;
  productId: string;
  amount: number;
  cost?: number;
  margin?: number;

  postId?: string;
  campaignId?: string;
  creativeId?: string;
  accountId?: string;

  source: RevenueEventSource;
  timestamp: number;

  /** Attributjonssikkerhet (samme poeng som scoreAttribution i pipeline). */
  confidence?: number;
};

/** Krever postId for ai_social/ads (fail-closed mot fantom-attributjon). */
export function isTraceableRevenueEvent(e: RevenueEvent): boolean {
  if (!e.orderId?.trim() || !e.productId?.trim()) return false;
  if (!(typeof e.amount === "number" && Number.isFinite(e.amount) && e.amount >= 0)) return false;
  if (e.source === "direct") return true;
  return Boolean(e.postId?.trim());
}
