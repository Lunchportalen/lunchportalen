/**
 * PHASE 17MENU.1 — Provider contribution margin (costs private to provider).
 */

import { COMMISSION_RATE_BPS, COMMISSION_DENOMINATOR, commissionExactNumerator } from "@/lib/billing/exactCommissionBps";

export type ProviderCostInputs = {
  ingredient_cost_minor: number;
  packaging_cost_minor: number;
  direct_labor_cost_minor: number;
  waste_allowance_minor: number;
  energy_allowance_minor: number;
  delivery_allocation_minor: number;
  other_variable_costs_minor: number;
  target_contribution_bps: number;
  minimum_contribution_bps: number;
};

export type MarginResult = {
  provider_net_price_minor: number;
  variable_cost_minor: number;
  commission_exact_numerator: number;
  commission_invoice_minor_floor: number;
  contribution_minor: number;
  contribution_bps: number;
  status: "healthy" | "below_minimum" | "negative";
  block_publication: boolean;
};

function int(n: number, label: string): number {
  if (!Number.isInteger(n) || !Number.isSafeInteger(n)) {
    throw new Error(`FLOATING_POINT_FINANCIAL_USAGE:${label}`);
  }
  return n;
}

export function calculateProviderContribution(args: {
  providerNetPriceMinor: number;
  costs: ProviderCostInputs;
  allowNegativeOverride?: boolean;
}): MarginResult {
  const price = int(args.providerNetPriceMinor, "provider_net_price");
  const c = args.costs;
  const variable =
    int(c.ingredient_cost_minor, "ingredient") +
    int(c.packaging_cost_minor, "packaging") +
    int(c.direct_labor_cost_minor, "labor") +
    int(c.waste_allowance_minor, "waste") +
    int(c.energy_allowance_minor, "energy") +
    int(c.delivery_allocation_minor, "delivery") +
    int(c.other_variable_costs_minor, "other");

  const commission_exact_numerator = commissionExactNumerator(price);
  const commission_invoice_minor_floor = Math.trunc(commission_exact_numerator / COMMISSION_DENOMINATOR);
  const contribution_minor = price - variable - commission_invoice_minor_floor;
  const contribution_bps =
    price === 0 ? 0 : Math.trunc((contribution_minor * COMMISSION_DENOMINATOR) / price);

  let status: MarginResult["status"] = "healthy";
  if (contribution_minor < 0) status = "negative";
  else if (contribution_bps < int(c.minimum_contribution_bps, "min_contrib")) status = "below_minimum";

  const block_publication = status === "negative" && !args.allowNegativeOverride;

  return {
    provider_net_price_minor: price,
    variable_cost_minor: variable,
    commission_exact_numerator,
    commission_invoice_minor_floor,
    contribution_minor,
    contribution_bps,
    status,
    block_publication,
  };
}

export { COMMISSION_RATE_BPS };
