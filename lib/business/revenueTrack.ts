import "server-only";

import { recordRevenue } from "@/lib/business/revenue";

/**
 * Real revenue signal — same attribution stack as {@link recordRevenue} (`trackConversion` source is `"ai"` by contract).
 * Use from approved flows only (e.g. after explicit superadmin + production approval in API).
 */
export async function recordRealRevenue(amount: number, context?: Record<string, unknown>): Promise<void> {
  const amt = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  if (amt <= 0) return;

  await recordRevenue({
    amount: amt,
    source: "customer",
    context: {
      ...(context && typeof context === "object" && !Array.isArray(context) ? context : {}),
      pipeline: "real_business_engine",
    },
  });

  console.log("[REAL_REVENUE]", { amount: amt });
}
