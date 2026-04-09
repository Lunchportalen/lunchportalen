/**
 * Mapper kontrolltårn-snapshot til finansvarsel-inndata (fail-closed).
 */

import type { FinancialAlertRunInput } from "@/lib/alerts/types";

export function financialAlertInputFromControlTower(args: {
  revenueOk: boolean;
  revenueToday: number;
  revenueYesterday: number;
  finance: { inputs: { adSpend: number }; adSpendKnown: boolean };
  osloHour: number;
  ordersCountedToday: number;
}): FinancialAlertRunInput {
  return {
    dataTrusted: args.revenueOk,
    revenueToday: args.revenueToday,
    revenueYesterday: args.revenueYesterday,
    profitToday: null,
    profitYesterday: null,
    adSpend: args.finance.inputs.adSpend,
    adSpendKnown: args.finance.adSpendKnown,
    osloHour: args.osloHour,
    ordersCountedToday: args.ordersCountedToday,
    roasCurrent: null,
    roasPrevious: null,
  };
}
