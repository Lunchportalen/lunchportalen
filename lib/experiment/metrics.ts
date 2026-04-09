/**
 * Omsetning per variant-label, filtrert på `social_post_id` + valgfri attributt-postId.
 * Ingen beslutning her — kun aggregering for winner-steg.
 */

export type OrderLikeForVariant = {
  social_post_id?: string | null;
  line_total?: unknown;
  attribution?: unknown;
};

function lineTotalNum(o: OrderLikeForVariant): number {
  const lt = o.line_total;
  if (typeof lt === "number" && Number.isFinite(lt)) return lt;
  if (typeof lt === "string" && lt.trim()) {
    const n = Number(lt);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function attributionPostId(o: OrderLikeForVariant): string {
  const a = o.attribution;
  if (a && typeof a === "object" && !Array.isArray(a)) {
    const p = (a as Record<string, unknown>).postId;
    if (typeof p === "string") return p;
  }
  return "";
}

/**
 * Summerer omsetning for ordre som matcher postId A eller B (primært `social_post_id`).
 */
export function computeVariantMetrics(orders: OrderLikeForVariant[], postId: string): { A: number; B: number } {
  const byVariant = { A: 0, B: 0 };
  for (const o of orders) {
    const sid = typeof o.social_post_id === "string" ? o.social_post_id : "";
    const ap = attributionPostId(o);
    if (sid !== postId && ap !== postId) continue;

    const v = (o as { variant?: unknown }).variant;
    const label = v === "B" || v === "b" ? "B" : "A";
    const amt = lineTotalNum(o);
    if (label === "B") byVariant.B += amt;
    else byVariant.A += amt;
  }
  return byVariant;
}

/**
 * To eksplisitte post-id (A og B) — foretrukket for SoMe A/B der ordre er knyttet til `social_post_id`.
 */
export function computeVariantMetricsByPostIds(
  orders: OrderLikeForVariant[],
  postIdA: string,
  postIdB: string
): { A: number; B: number } {
  let a = 0;
  let b = 0;
  for (const o of orders) {
    const sid = typeof o.social_post_id === "string" ? o.social_post_id : "";
    const ap = attributionPostId(o);
    const amt = lineTotalNum(o);
    if (sid === postIdA || ap === postIdA) a += amt;
    else if (sid === postIdB || ap === postIdB) b += amt;
  }
  return { A: a, B: b };
}
