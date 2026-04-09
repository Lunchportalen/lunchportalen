/**
 * Lager og ledetid — kun støtteberegninger (ingen auto-bestilling).
 */

export type Stock = {
  productId: string;
  onHand: number;
  leadDays: number;
  wasteFactor?: number; // 0–0.2 typisk
};

export function safetyStock(daily: number, leadDays: number, buffer = 1.3): number {
  const d = typeof daily === "number" && Number.isFinite(daily) ? Math.max(0, daily) : 0;
  const l = typeof leadDays === "number" && Number.isFinite(leadDays) ? Math.max(0, leadDays) : 0;
  return Math.ceil(d * l * buffer);
}
