/**
 * Read-only revenue projection from an order row — no synthetic totals.
 */

import type { OrderAttributionRecord } from "@/lib/revenue/types";

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type OrderRevenueTrackInput = {
  id?: string | null;
  line_total?: unknown;
  total?: unknown;
  attribution?: unknown;
  product_id?: unknown;
};

/**
 * Maps DB/order shape to explainable fields. Omits unknown product lines (lunch orders are not SKU-level).
 */
export function trackRevenue(order: OrderRevenueTrackInput | null | undefined): {
  orderId: string | null;
  postId: string | null;
  source: string | null;
  productId: string | null;
  revenue: number;
} | null {
  if (!order || typeof order !== "object") return null;

  const attr = order.attribution as OrderAttributionRecord | null | undefined;
  const postId = attr?.postId != null ? String(attr.postId).trim() : null;
  const source = attr?.source != null ? String(attr.source).trim() : null;
  const metaProductId = attr?.productId != null ? String(attr.productId).trim() : null;

  const revenue = num(order.line_total ?? order.total);
  const oid = order.id != null ? String(order.id).trim() : null;

  return {
    orderId: oid,
    postId: postId || null,
    source: source || null,
    productId: metaProductId || (order.product_id != null ? String(order.product_id).trim() : null),
    revenue,
  };
}
