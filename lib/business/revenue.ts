import "server-only";

import { trackConversion } from "@/lib/ai/attribution";

import { emitBusinessEvent } from "@/lib/business/events";

export type RecordRevenueInput = {
  amount: number;
  source: string;
  context?: Record<string, unknown>;
};

/**
 * Ekte inntektssignal til AI-attribusjon (best effort — samme kontrakt som trackConversion).
 */
export async function recordRevenue(input: RecordRevenueInput): Promise<void> {
  const amt = typeof input.amount === "number" && Number.isFinite(input.amount) ? input.amount : 0;
  if (amt <= 0) return;

  await trackConversion({
    source: "ai",
    key: input.source,
    revenue: amt,
    context: input.context && typeof input.context === "object" && !Array.isArray(input.context) ? input.context : {},
  });

  console.log("[REAL_REVENUE]", input);
  emitBusinessEvent({ type: "revenue_signal", source: input.source, amount: amt });
}
