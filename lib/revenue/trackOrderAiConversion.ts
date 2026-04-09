import "server-only";

import { recordRevenue } from "@/lib/business/revenue";

/**
 * Best-effort order → AI learning signal (via {@link recordRevenue} / trackConversion). Never throws to caller.
 */
export async function trackOrderAiConversion(input: {
  orderId: string;
  companyId: string | null;
  revenue: number;
}): Promise<void> {
  try {
    await recordRevenue({
      amount: input.revenue,
      source: "order",
      context: { orderId: input.orderId, companyId: input.companyId },
    });
  } catch {
    /* fail-safe */
  }
}
