/**
 * Kost- og mengdekontroll — fail-closed for superadmin-innkjøpsforslag.
 */

export const PROCUREMENT_MAX_ESTIMATED_COST_NOK = 10_000;

export type ProcurementOrderLike = {
  suggestedQty: number;
  estimatedCost: number;
};

export function validateProcurement(order: ProcurementOrderLike): boolean {
  if (!(typeof order.suggestedQty === "number" && Number.isFinite(order.suggestedQty) && order.suggestedQty > 0)) {
    return false;
  }
  if (!(typeof order.estimatedCost === "number" && Number.isFinite(order.estimatedCost))) {
    return false;
  }
  if (order.estimatedCost > PROCUREMENT_MAX_ESTIMATED_COST_NOK) return false;
  return true;
}
