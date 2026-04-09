/**
 * Leverandørmodell — kun data for beslutningsstøtte (ingen auto-bestilling).
 */

export type Supplier = {
  id: string;
  name: string;
  pricePerUnit: number;
  deliveryDays: number;
  reliabilityScore: number; // 0–1
  minOrderQty?: number;
};
